import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/Cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

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


    const { fullname, email, username, password } = req.body
    console.log("email:", email);

    if (
        [fullname, email, username, password].some((field) => (
            field?.trim() === ""
        ))
    ) {
        throw new ApiError(400, "All field are reduired")
    }

    const existedUser = User.findOne({
        $ro: [{ username }, { email }]
    })

    if (existedUser) {
        throw new ApiError(409, "User with email or username already exist")
    }

    const avatarLocalPath = req.filse?.avatar[0]?.path;
    const coverImageLocalPath = req.filse?.coverImage[0]?.path;

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!avatar) {
        throw new ApiError(400, "Avatar file is required")
    }


    const user = await User.create({
        fullname,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()

    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if (!createdUser) {
        throw new ApiError(500, "something went wrong while registering the user")
    }
    return res.status(201).json(
        new ApiResponse(200,createdUser,"User creatde sucessfully")
    )


    // res.status(200).json({
    //     message: "hello"
    // })
})

export { registerUser }