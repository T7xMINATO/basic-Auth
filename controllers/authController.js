// import User from "../models/userModel.js";
import bcrypt from "bcryptjs";
import createHttpError from "http-errors";

import { generateToken } from "../services/JwtService.js";
import { validationResult } from "express-validator";
// import { verify } from "jsonwebtoken";
import transporter from "../config/nodeMailer.js";
import userModel from "../models/userModel.js";

const registerController = async (req, res, next) => {
    try {
        // validation on request body express-validator se karte hai
        // agar error hai to error throw karte hai
        // error in register-validator.js file
        //middleware applied registerValidator on register route
        const result = validationResult(req)
        // agar result.isEmpty nahi hai to first error throw karte hai
        if (!result.isEmpty()) {
            throw createHttpError(400, result.array()[0].msg)
        }
        // destructure all inputs values from req.body...
        const { firstName, lastName, email, password, role } = req.body;
        // userMode is mongoose model... model use for database operations
        // findOne method is also mongoose method use for finding any user in database

        const userExist = await userModel.findOne({ email });
        // if (userExist) return res.status(409).json({ message: "Email Already Exist" })
        // http-errors is used to create error with status code
        // if userExist is true then throw error with status code 409
        if (userExist) throw createHttpError(409, "Email Already Exist")

            // we will not save original password in db
            // use bycrypt library to hash the password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // genarate otp for email verification
        const otp = String(Math.floor(100000 + Math.random() * 900000))
        // console.log(otp, "otp")

        // create an expiration time for the OTP (1 minute from now)
        const expireAt = Date.now() + 1 * 60 * 1000;
        // console.log(expireAt, "expire at")

        // Define an array of background colors for the avatar
        const backgroundColors = [
            "e57f7f",
            "69a69d",
            "7a9461",
            "98b8e1",
            "e0d084",
            "516087",
            "ab9f8e",
            "c150ad",
            "be94eb",
            "a6a7ae",
        ];

        // Choose a random background color from the array
        const randomBackgroundColor =
            backgroundColors[Math.floor(Math.random() * backgroundColors.length)];

            // Create a new user in the database with the provided details
            // it is db opreation thats why we use await
        await userModel.create({

            firstName,
            lastName,
            email,
            password: hashedPassword,
            role,
            verifyOtp: otp,
            verifyOtpExpireAt: expireAt,
            avatar: `https://ui-avatars.com/api/?name=${firstName}+${lastName}&&color=fff&&background=${randomBackgroundColor}&&rounded=true&&font-size=0.44`
        })

        // for sending email we use nodeMailer library
        // transporter is imported from config/nodeMailer.js file
        await transporter.sendMail({
            from: '"sumitbhalekar598@gmail.com', // sender address
            to: email, // list of receivers
            subject: "Email Verification Code", // Subject line
            text: `Your verification OTP is ${otp} verify your account using this otp`, // plain text body
        });

        // sending responce to client
        res.status(201).json({ message: "Enter OTP sent on your email" })


    } catch (error) {
        // res.status(500).json({ message: "internal server error", error: error.message })
        // we have defined global error handler in app.js file
        next(error)
    }
}

const verifyEmailController = async (req, res, next) => {
    try {
        const { email, verifyOtp } = req.body;

        if (!email || !verifyOtp) { throw createHttpError(400, "Email and OTP are required") }

          // we get all info of user from db if user exist
        const user = await userModel.findOne({ email });
        if (!user) throw createHttpError(404, "User Not Found")

            // user.verifyOtp from db and verifyOtp from req.body
            // otp saved in db not equal to req.body otp OR db otp is empty
        if (user.verifyOtp !== verifyOtp || user.verifyOtp === '') {
            throw createHttpError(401, "Invalid OTP")
        }
        
        // current time is greater than otp expire time
        if (user.verifyOtpExpireAt < Date.now()) {
            // if otp is expired then delete user from db
            await userModel.findByIdAndDelete(user._id)
            throw createHttpError(401, "OTP Expired register again")
        }

            // update user data
        user.isVerified = true;
        user.verifyOtp = "";
        user.verifyOtpExpireAt = 0;
        //save () mongoose syntax used for saving user info in db
        await user.save();

        res.json({ message: "Email Verified Successfully" })

    } catch (error) {
        next(error)
    }
}

const loginController = async (req, res, next) => {
    try {
         // validation on request body express-validator se karte hai
        // agar error hai to error throw karte hai
        // error in login-validator.js file
        //middleware applied loginValidator on login route
        const result = validationResult(req)
        if (!result.isEmpty()) {
            throw createHttpError(400, result.array()[0].msg)
        }
        const { email, password } = req.body;
        const user = await userModel.findOne({ email })
        if (!user) throw createHttpError(401, "Invalid email or password")

        //  user.password is hashed PW saved in db
        // password is form req.body
        // bcrypt.compare() is used to compare hashed password with plain text password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) throw createHttpError(401, "Invalid email or password")

        if (!user.isVerified) throw createHttpError(401, "Please verify your email first")
        // token generate karne ka code hai
        // ye hamara payload hai....user data ka data token me save karenge
        const userData = {
            userId: user._id,
            role: user.role
        }
        const token = generateToken(userData);

        //    const decode= verifyToken(token);
        //    console.log(decode)


        res.json({ token })


    } catch (error) {
        next(error)
    }
}

const profileController = async (req, res, next) => {
    const id = req.user._id;
    // console.log(id,"coming from token..from isAuthenticated")
    try {

        const userId = req.params.id
        //    console.log(userId,"user id")
        if (id !== userId) throw createHttpError(401, "Unauthorized")
        const user = await userModel.findById({ _id: userId }).select(" -password -__v -createdAt -updatedAt")
        res.json(user)
    } catch (error) {
        next(error)
    }
}

const protectedController = (req, res, next) => {
    res.json({ message: "You can access it." })
}

const otpResetPasswordController = async (req, res, next) => {
    try {
        const { email } = req.body;
        if (!email) { throw createHttpError(400, "Email are required") }
        const user = await userModel.findOne({ email });
        if (!user) throw createHttpError(404, "User Not Found")

        const otp = String(Math.floor(100000 + Math.random() * 900000))
        // console.log(otp, "otp")

        const expireAt = Date.now() + 1 * 60 * 1000;
        // console.log(expireAt, "expire at")

        await transporter.sendMail({
            from: '"sumitbhalekar598@gmail.com', // sender address
            to: email, // list of receivers
            subject: "OTP for reset password", // Subject line
            text: `Your verification OTP is ${otp} to reset password use this otp`, // plain text body
        });

        user.resetOtp = otp;
        user.resetOtpExpireAt = expireAt;
        await user.save();

        res.status(201).json({ message: "Enter OTP sent on your email" })

    } catch (error) {
        next(error)
    }
}

const resetPasswordController = async (req, res, next) => {
    try {
        const { email, resetOtp, password } = req.body;

        if (!email || !resetOtp || !password) { throw createHttpError(400, "Email, OTP & password are required") }

        const user = await userModel.findOne({ email });
        if (!user) throw createHttpError(404, "User Not Found")

        if (user.resetOtp !== resetOtp || user.resetOtp === '') {
            throw createHttpError(401, "Invalid OTP")
        }

        if (user.resetOtpExpireAt < Date.now()) {
            throw createHttpError(401, "OTP Expired")
        }


        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        user.password = hashedPassword;
        user.resetOtp = "";
        user.resetOtpExpireAt = 0;
        await user.save();

        res.json({ message: "Password reset successfully" });
    } catch (error) {
        next(error);
    }
}

export { registerController, loginController, profileController, protectedController, verifyEmailController, otpResetPasswordController, resetPasswordController };