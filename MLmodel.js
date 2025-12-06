// classifier/model.js
import fetch from "node-fetch";

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:8000/predict";

/**
 * Call ML service and return a safe decision object.
 * Returns:
 * {
 *   priority: "urgent"|"high"|"normal",
 *   confidence: 0.0-1.0,
 *   probs: { high, normal, urgent } | null,
 *   explain: {...} | null,
 *   manual_review: boolean,
 *   raw: original ml json or fallback info
 * }
 */
export async function classifyIssue(category, description) {
  const payload = { category, description };
  const controller = new AbortController();
  const timeoutMs = parseInt(process.env.ML_TIMEOUT_MS || "5000", 10);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch(ML_SERVICE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      throw new Error(`ML service responded with status ${resp.status}`);
    }

    const ml = await resp.json();
    // ml: { priority, probs: {high, normal, urgent}, explain }
    const probs = ml.probs || {};
    const explain = ml.explain || null;

    // Ensure fields exist
    const urgent_prob = Number(probs["urgent"] || 0);
    const high_prob = Number(probs["high"] || 0);
    const normal_prob = Number(probs["normal"] || 0);
    const max_prob = Math.max(urgent_prob, high_prob, normal_prob, 0);

    let finalPriority;
    if (urgent_prob >= 0.7) finalPriority = "urgent";
    else if (urgent_prob >= 0.5 || high_prob >= 0.6) finalPriority = "high";
    else finalPriority = "normal";

    const safetyTiltCategories = ["Public Safety", "Electricity", "Roads & Infrastructure"];
    let manual_review = false;
    if (safetyTiltCategories.includes(category)) {
      if (urgent_prob >= 0.4 && urgent_prob < 0.7) {
        finalPriority = urgent_prob >= 0.55 ? "urgent" : "high";
        manual_review = true; // ask human if borderline
      }
    }

    if (max_prob < 0.45) manual_review = true;

    const result = {
      priority: finalPriority,
      confidence: probs[finalPriority] ? Number(probs[finalPriority]) : max_prob,
      probs,
      explain,
      manual_review,
      raw: ml
    };

    return result;
  } catch (err) {
    clearTimeout(timeout);
    console.error("ML service error:", err.message);

    // Conservative fallback: escalate to high and require manual review
    return {
      priority: "high",
      confidence: 0.35,
      probs: null,
      explain: { fallback: true, error: err.message },
      manual_review: true,
      raw: null
    };
  }
}
