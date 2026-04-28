"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var mongoose_1 = require("mongoose");
var UserDeviceSchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User ID is required'],
    },
    vehicleId: {
        type: String,
        required: [true, 'Vehicle ID is required'],
        unique: true,
        trim: true,
    },
    deviceName: {
        type: String,
        required: [true, 'Device name is required'],
        trim: true,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    registeredAt: {
        type: Date,
        default: Date.now,
    },
}, {
    timestamps: true,
});
exports.default = mongoose_1.default.models.UserDevice || mongoose_1.default.model('UserDevice', UserDeviceSchema);
