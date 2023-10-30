"use strict";
// OP_0 {pubKeyHash}
Object.defineProperty(exports, "__esModule", { value: true });
exports.check = void 0;
const __1 = require("../../");
const __2 = require("../../");
function check(script) {
    const buffer = __1.script.compile(script);
    return buffer.length === 22 && buffer[0] === __2.opcodes.OP_0 && buffer[1] === 0x14;
}
exports.check = check;
check.toJSON = () => {
    return 'Witness pubKeyHash output';
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3V0cHV0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3RlbXBsYXRlcy93aXRuZXNzcHVia2V5aGFzaC9vdXRwdXQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBLG9CQUFvQjs7O0FBRXBCLDhCQUEyQztBQUMzQyw4QkFBaUM7QUFFakMsU0FBZ0IsS0FBSyxDQUFDLE1BQXVDO0lBQzNELE1BQU0sTUFBTSxHQUFHLFVBQU8sQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUM7SUFFdkMsT0FBTyxNQUFNLENBQUMsTUFBTSxLQUFLLEVBQUUsSUFBSSxNQUFNLENBQUMsQ0FBQyxDQUFDLEtBQUssV0FBTyxDQUFDLElBQUksSUFBSSxNQUFNLENBQUMsQ0FBQyxDQUFDLEtBQUssSUFBSSxDQUFDO0FBQ2xGLENBQUM7QUFKRCxzQkFJQztBQUNELEtBQUssQ0FBQyxNQUFNLEdBQUcsR0FBVyxFQUFFO0lBQzFCLE9BQU8sMkJBQTJCLENBQUM7QUFDckMsQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLy8gT1BfMCB7cHViS2V5SGFzaH1cblxuaW1wb3J0IHsgc2NyaXB0IGFzIGJzY3JpcHQgfSBmcm9tICcuLi8uLi8nO1xuaW1wb3J0IHsgb3Bjb2RlcyB9IGZyb20gJy4uLy4uLyc7XG5cbmV4cG9ydCBmdW5jdGlvbiBjaGVjayhzY3JpcHQ6IEJ1ZmZlciB8IEFycmF5PG51bWJlciB8IEJ1ZmZlcj4pOiBib29sZWFuIHtcbiAgY29uc3QgYnVmZmVyID0gYnNjcmlwdC5jb21waWxlKHNjcmlwdCk7XG5cbiAgcmV0dXJuIGJ1ZmZlci5sZW5ndGggPT09IDIyICYmIGJ1ZmZlclswXSA9PT0gb3Bjb2Rlcy5PUF8wICYmIGJ1ZmZlclsxXSA9PT0gMHgxNDtcbn1cbmNoZWNrLnRvSlNPTiA9ICgpOiBzdHJpbmcgPT4ge1xuICByZXR1cm4gJ1dpdG5lc3MgcHViS2V5SGFzaCBvdXRwdXQnO1xufTtcbiJdfQ==