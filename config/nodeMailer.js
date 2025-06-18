import nodemailer from "nodemailer";


const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: "sumitbhalekar598@gmail.com",
        pass:"hvcn lkpa doze ziht",
    },
});

export default transporter;