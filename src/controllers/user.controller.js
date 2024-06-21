import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { deleteImage, uploadOnCloudinary } from "../utils/Cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
// import mongoose from "mongoose"; 

const generateAccessAndRefreshTokens = async (userId) => {
    try {
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });

        return { accessToken, refreshToken };
    } catch (error) {
        throw new ApiError(
            500,
            "something went wrong while generating refersh and access token"
        );
    }
};

const registerUser = asyncHandler(async (req, res) => {
    // get user detail from frontend
    // validation - not empty
    // check if user already exist - username , eamil
    // check for images , chech for avtar
    // upload them to cloudinary , check avtar is upload successfully
    // create user object - create endtry in db
    // remove and refresh token field from response
    // check fro user creation
    // return res

    const { fullname, email, username, password } = req.body;
    // console.log("email:", email);

    if (
        [fullname, email, username, password].some((field) => field?.trim() === "")
    ) {
        throw new ApiError(400, "All field are reduired");
    }

    const existedUser = await User.findOne({
        $or: [{ username }, { email }],
    });

    if (existedUser) {
        throw new ApiError(409, "User with email or username already exist");
    }

    const avatarLocalPath = req.files?.avatar?.[0]?.path;
    // let coverImageLocalPath;
    const coverImageLocalPath = req.files?.coverImage?.[0]?.path;
    // console.log(avatarLocalPath);
    // console.log(coverImageLocalPath);

    // if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
    //     coverImageLocalPath = req.files.coverImage[0].path
    // }

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required");
    }

    const coverImage = coverImageLocalPath
        ? await uploadOnCloudinary(coverImageLocalPath)
        : null;
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    // console.log(avatar);

    if (!avatar) {
        throw new ApiError(400, "error uploading avatar");
    }

    const user = await User.create({
        fullname,
        avatar: avatar.url,
        avatarPublicId: avatar.public_id,
        coverImage: coverImage?.url || "",
        coverImagePublicId: coverImage?.public_id || "",
        email,
        password,
        username: username.toLowerCase(),
    });

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    );

    if (!createdUser) {
        throw new ApiError(500, "something went wrong while registering the user");
    }
    return res
        .status(201)
        .json(new ApiResponse(200, createdUser, "User creatde sucessfully"));

    // res.status(200).json({
    //     message: "hello"
    // })
});

const loginUser = asyncHandler(async (req, res) => {
    // req body -> data
    // username or email
    // find the user
    // check password
    // access and refresh token
    // send cookie

    const { email, username, password } = req.body;
    // console.log(username);

    if (!(email || username)) {
        throw new ApiError(400, "username or email is reqired");
    }

    const user = await User.findOne({
        $or: [{ username }, { email }],
    });

    if (!user) {
        throw new ApiError(409, "User with email or username does not exist");
    }
    console.log(password);
    const isPasswordvalid = await user.isPasswordCorrect(password);
    console.log(isPasswordvalid);

    if (!isPasswordvalid) {
        throw new ApiError(401, "Password is incorrect");
    }
    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
        user._id
    );

    const loggedInUser = await User.findById(user._id).select(
        "-password -refreshToken"
    );

    const option = {
        httpOnly: true,
        secure: true,
    };

    return res
        .status(200)
        .cookie("accessToken", accessToken, option)
        .cookie("refreshToken", refreshToken, option)
        .json(
            new ApiResponse(
                200,
                {
                    user: loggedInUser,
                    accessToken,
                    refreshToken,
                },
                "user logged in successfully"
            )
        );
});

const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined,
            },
        },
        {
            new: true,
        }
    );

    const option = {
        httpOnly: true,
        secure: true,
    };

    return res
        .status(200)
        .clearCookie("accessToken", option)
        .clearCookie("refreshToken", option)
        .json(new ApiResponse(200, {}, "User logged out"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken =
        req.cookies.refreshToken || req.body.refreshToken;

    if (!incomingRefreshToken) {
        throw new ApiError(401, "unauthorized request");
    }

    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        );

        const user = await User.findById(decodedToken?._id);

        if (!user) {
            throw new ApiError(401, "Invalid refresh token");
        }

        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "refresh token is expired or used");
        }

        const option = {
            httpOnly: true,
            secure: true,
        };

        const { accessToken, newRefreshToken } =
            await generateAccessAndRefreshTokens(user._id);

        return res
            .status(200)
            .cookie("accessToken", accessToken, option)
            .cookie("refreshToken", newRefreshToken, option)
            .json(
                new ApiResponse(
                    200,
                    { accessToken, refreshToken: newRefreshToken },
                    "Access token refreshed"
                )
            );
    } catch (error) {
        throw new ApiError(401, error?.massage || "Invalid refresh token");
    }
});

const changCurrentPassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;

    const user = await User.findById(req.user?._id);
    // console.log(user);
    // console.log(oldPassword);

    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

    if (!isPasswordCorrect) {
        throw new ApiError(400, "invalid old password");
    }

    user.password = newPassword;
    await user.save({ validateBeforeSave: false });

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "passWord changed successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
    return res
        .status(200)
        .json(200, req.user, "current user fetched successfully");
});

const updateAllSAccountDetail = asyncHandler(async (req, res) => {
    const { fullname, email } = req.body;

    if (!(fullname || email)) {
        throw new ApiError(400, "All field are required");
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullname: fullname,
                email: email,
            },
        },
        {
            new: true,
        }
    ).select("-password");

    return res
        .status(200)
        .json(new ApiResponse(200, user, "Account details update successfull"));
});

const updateAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path;

    if (!avatarLocalPath) {
        throw new ApiError(400, "avatar file is missing");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);

    if (!avatar.url) {
        throw new ApiError(400, "error while uploading on avatar");
    }
    const user = await User.findById(req.user?._id).select(
        "-password -refreshToken "
    );
    // console.log(user1.avatarPublicId);
    const publicId = user.avatarPublicId;
    // console.log(publicId);

    user.avatar = avatar.url;
    user.avatarPublicId = avatar.public_id;
    await user.save();

    // not using due to again db call is made
    // const user = await User.findByIdAndUpdate(
    //     req.user?._id,
    //     {
    //         $set: {
    //             avatar: avatar.url,
    //             avatarPublicId: avatar.public_id,
    //         }
    //     },
    //     { new: true }
    // ).select("-password")

    deleteImage(publicId);

    return res
        .status(200)
        .json(new ApiResponse(200, user, "avatar is update successfully"));
});

const updateCoverImage = asyncHandler(async (req, res) => {
    const coverImageLocalPath = req.file?.path;

    if (!coverImageLocalPath) {
        throw new ApiError(400, "avatar file is missing");
    }
    const user = await User.findById(req.user?._id).select(
        "-password -refreshToken "
    );

    const publicId = user.coverImagePublicId;

    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if (!coverImage.url) {
        throw new ApiError(400, "error while uploading on avatar");
    }

    user.coverImage = coverImage.url;
    user.coverImagePublicId = coverImage.public_id;
    await user.save();

    // not using due to again db call is made
    // const user = await User.findByIdAndUpdate(
    //     req.user?._id,
    //     {
    //         $set: {
    //             avatar: avatar.url,
    //             avatarPublicId: avatar.public_id,
    //         }
    //     },
    //     { new: true }
    // ).select("-password")

    deleteImage(publicId);

    return res
        .status(200)
        .json(new ApiResponse(200, user, "avatar is update successfully"));
});

const getUserchannelProfile = asyncHandler(async (req, res) => {
    const { username } = req.params;

    if (!username) {
        throw new ApiError(400, "user is missing");
    }

    const channel = await User.aggregate([
        {
            username: username?.toLowerCase(),
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {
                subscribersCount: {
                    $size: "$subscribers"
                },
                channelSubscribedToCount: {
                    $size: "$subscribedTo"
                },
                isSubscribed: {
                    $cond: {
                        if: { $in: [req.user?._id, "$subscribers.subscriber"] },
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                fullname: 1,
                username: 1,
                subscribersCount: 1,
                channelSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1,


            }
        }

    ]);

    if (!channel?.length) {
        throw new ApiError(404, "channel does not exists")
    }
    console.log(channel);

    return res
        .status(200)
        .json(
            new ApiResponse(200, channel[0], "user channel fetched successfully")
        )
});

const getWatchHistory = asyncHandler(async (req, res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchhistory",
                foreignField: "-id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "user",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullname: 1,
                                        username: 1,
                                        avatar: 1,
                                    },

                                }
                            ]
                        },
                    },
                    {
                        $addFields: {
                            owner: {
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res 
    .status(200)
    .json(
        new ApiResponse(
            200,
            user[0].watchHistory,
            "Watch history fetched Successfully"
        )
    )
})

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changCurrentPassword,
    getCurrentUser,
    updateAllSAccountDetail,
    updateAvatar,
    updateCoverImage,
    getUserchannelProfile,
    getWatchHistory
};