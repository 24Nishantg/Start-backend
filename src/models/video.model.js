import mongoose, { Schema } from "mongoose";
import mongosseAggregatePaginate from "mongoose-aggregate-paginate-v2"

const vedioSchaema = new mongoose.Schema(
    {
        videoFile:{
            type: String, // coludnairy
            required: true
        },
        thumonail:{
            type: String,
            required: true
        },
        title:{
            type: String,
            required: true
        },
        descripition:{
            type: String,
            required: true
        },
        duration:{ 
            type: Number,
            required: true
        },
        view:{
            type: Number,
            default: 0
        },
        isPublished:{
            type: Boolean,
            default: true
        },
        owner:{
            type: Schema.type.ObjectId,
            ref: "User"

        },
    },
    { 
        timestamps: true 
    }
)

vedioSchaema.plugin(mongosseAggregatePaginate)

export const Vedio = mongoose.model("vedio", vedioSchaema)