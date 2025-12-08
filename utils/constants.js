import axios from "axios";

export async function translateToHindi(text) {
  try {
    const res = await axios.post("http://127.0.0.1:8000/translate", {
      q: text,
      source: "en",
      target: "hi"
    });
    return res.data.translatedText || text;
  } catch (err) {
    console.log("Hindi translation failed:", err.message);
    return text; // fallback
  }
}
