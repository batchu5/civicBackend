import nodemailer from "nodemailer";

async function sendMail(title, description, link, toEmail) {
    try {
        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.MY_EMAIL,
                pass: process.env.MY_EMAIL_PASS,
            },
        });

        const mailOptions = {
            from: process.env.MY_EMAIL,
            to: toEmail,
            subject: title,
            html: `
                <p>${description}</p>
                <p>
                    <a href="${link}" target="_blank" style="color: blue; font-weight: bold;">
                        Click here
                    </a>
                </p>
            `,
        };

        await transporter.sendMail(mailOptions);
        console.log("mail sent bro");
        return { success: true, message: "Mail sent" };

    } catch (err) {
        console.error(err);
        return { success: false, message: "Mail failed" };
    }
}

export default sendMail;


