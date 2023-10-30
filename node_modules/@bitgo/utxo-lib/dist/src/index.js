"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionBuilder = exports.supportsSegwit = exports.supportsTaproot = exports.isTestnet = exports.isMainnet = exports.getTestnet = exports.getMainnet = exports.getNetworkName = exports.isValidNetwork = exports.getNetworkList = exports.networks = exports.p2trPayments = exports.testutil = exports.taproot = exports.classify = exports.addressFormat = exports.address = exports.bitgo = void 0;
__exportStar(require("bitcoinjs-lib"), exports);
exports.bitgo = require("./bitgo");
exports.address = require("./address");
exports.addressFormat = require("./addressFormat");
exports.classify = require("./classify");
exports.taproot = require("./taproot");
exports.testutil = require("./testutil");
__exportStar(require("./noble_ecc"), exports);
exports.p2trPayments = require("./payments");
var networks_1 = require("./networks");
Object.defineProperty(exports, "networks", { enumerable: true, get: function () { return networks_1.networks; } });
Object.defineProperty(exports, "getNetworkList", { enumerable: true, get: function () { return networks_1.getNetworkList; } });
Object.defineProperty(exports, "isValidNetwork", { enumerable: true, get: function () { return networks_1.isValidNetwork; } });
Object.defineProperty(exports, "getNetworkName", { enumerable: true, get: function () { return networks_1.getNetworkName; } });
Object.defineProperty(exports, "getMainnet", { enumerable: true, get: function () { return networks_1.getMainnet; } });
Object.defineProperty(exports, "getTestnet", { enumerable: true, get: function () { return networks_1.getTestnet; } });
Object.defineProperty(exports, "isMainnet", { enumerable: true, get: function () { return networks_1.isMainnet; } });
Object.defineProperty(exports, "isTestnet", { enumerable: true, get: function () { return networks_1.isTestnet; } });
Object.defineProperty(exports, "supportsTaproot", { enumerable: true, get: function () { return networks_1.supportsTaproot; } });
Object.defineProperty(exports, "supportsSegwit", { enumerable: true, get: function () { return networks_1.supportsSegwit; } });
var transaction_builder_1 = require("./transaction_builder");
Object.defineProperty(exports, "TransactionBuilder", { enumerable: true, get: function () { return transaction_builder_1.TransactionBuilder; } });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7OztBQUFBLGdEQUE4QjtBQUU5QixtQ0FBaUM7QUFFakMsdUNBQXFDO0FBRXJDLG1EQUFpRDtBQUVqRCx5Q0FBdUM7QUFFdkMsdUNBQXFDO0FBRXJDLHlDQUF1QztBQUV2Qyw4Q0FBNEI7QUFFNUIsNkNBQTJDO0FBRTNDLHVDQWFvQjtBQVpsQixvR0FBQSxRQUFRLE9BQUE7QUFHUiwwR0FBQSxjQUFjLE9BQUE7QUFDZCwwR0FBQSxjQUFjLE9BQUE7QUFDZCwwR0FBQSxjQUFjLE9BQUE7QUFDZCxzR0FBQSxVQUFVLE9BQUE7QUFDVixzR0FBQSxVQUFVLE9BQUE7QUFDVixxR0FBQSxTQUFTLE9BQUE7QUFDVCxxR0FBQSxTQUFTLE9BQUE7QUFDVCwyR0FBQSxlQUFlLE9BQUE7QUFDZiwwR0FBQSxjQUFjLE9BQUE7QUFHaEIsNkRBQTJEO0FBQWxELHlIQUFBLGtCQUFrQixPQUFBIiwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0ICogZnJvbSAnYml0Y29pbmpzLWxpYic7XG5cbmV4cG9ydCAqIGFzIGJpdGdvIGZyb20gJy4vYml0Z28nO1xuXG5leHBvcnQgKiBhcyBhZGRyZXNzIGZyb20gJy4vYWRkcmVzcyc7XG5cbmV4cG9ydCAqIGFzIGFkZHJlc3NGb3JtYXQgZnJvbSAnLi9hZGRyZXNzRm9ybWF0JztcblxuZXhwb3J0ICogYXMgY2xhc3NpZnkgZnJvbSAnLi9jbGFzc2lmeSc7XG5cbmV4cG9ydCAqIGFzIHRhcHJvb3QgZnJvbSAnLi90YXByb290JztcblxuZXhwb3J0ICogYXMgdGVzdHV0aWwgZnJvbSAnLi90ZXN0dXRpbCc7XG5cbmV4cG9ydCAqIGZyb20gJy4vbm9ibGVfZWNjJztcblxuZXhwb3J0ICogYXMgcDJ0clBheW1lbnRzIGZyb20gJy4vcGF5bWVudHMnO1xuXG5leHBvcnQge1xuICBuZXR3b3JrcyxcbiAgTmV0d29yayxcbiAgTmV0d29ya05hbWUsXG4gIGdldE5ldHdvcmtMaXN0LFxuICBpc1ZhbGlkTmV0d29yayxcbiAgZ2V0TmV0d29ya05hbWUsXG4gIGdldE1haW5uZXQsXG4gIGdldFRlc3RuZXQsXG4gIGlzTWFpbm5ldCxcbiAgaXNUZXN0bmV0LFxuICBzdXBwb3J0c1RhcHJvb3QsXG4gIHN1cHBvcnRzU2Vnd2l0LFxufSBmcm9tICcuL25ldHdvcmtzJztcblxuZXhwb3J0IHsgVHJhbnNhY3Rpb25CdWlsZGVyIH0gZnJvbSAnLi90cmFuc2FjdGlvbl9idWlsZGVyJztcblxuZXhwb3J0IHsgTmV0d29yayBhcyBCaXRjb2luSlNOZXR3b3JrIH0gZnJvbSAnYml0Y29pbmpzLWxpYic7XG4iXX0=