import { checkSchema } from "express-validator";

export default checkSchema({
    password: {
        notEmpty: true,
        errorMessage: "Password is required",
        isLength: {
            options: { min: 6 },
            errorMessage: "Password must be at least 6 characters long"
        },
        trim: true,
        matches: {
            options:
                /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{6,}$/,
            errorMessage: "Password must contain at least one letter, one number, and one special character"
        }
    }
})