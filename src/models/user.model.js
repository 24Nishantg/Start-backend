import mongoose, { Schema } from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

const userScheam = new mongoose.Schema(
    {
        username: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            index: true
        },
        password: {
            type: String,
            required: [true, 'password is required'],
        },
        email: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,
        },
        fullname: {
            type: String,
            required: true,
            index: true,
            trim: true,
        },
        avatar: {
            type: String,
            required: true
        },
        coverImage: {
            type: String,
        },
        watchHistory: [
            {
                type: Schema.type.objectId,
                ref: "Video",
            }
        ],
        refreshToken: {
            type: String
        },
    },
    { timestamps: true }
);

userScheam.pre("save", async function(next) {
    if(this.isModified("password")) return next();

    this.password = bcrypt.hash(this.password, 10)
    next()
})

userScheam.methods.isPasswordCorrect = async function (password) {
    return await bcrypt.compare(password, this.password)
}

userScheam.methods.generateaCCSESToken = function(){
    return jwt.sign(
        {
            _id: this._id,
            email: this.email,
            username: this.username,
            fullname: this.fullname
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRY
        }
    )
}

userScheam.methods.generateRefreshToken = function(){
    return jwt.sign(
        {
            _id: this._id,
        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY
        }
    )
}

export const User = mongoose.model("User", userScheam);
