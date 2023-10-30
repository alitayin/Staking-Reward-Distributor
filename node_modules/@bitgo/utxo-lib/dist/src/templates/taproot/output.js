"use strict";
// OP_1 {scriptHash}
Object.defineProperty(exports, "__esModule", { value: true });
exports.check = void 0;
const __1 = require("../../");
const __2 = require("../../");
function check(script) {
    const buffer = __1.script.compile(script);
    return buffer.length === 34 && buffer[0] === __2.opcodes.OP_1 && buffer[1] === 0x20;
}
exports.check = check;
check.toJSON = () => {
    return 'Taproot output';
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3V0cHV0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3RlbXBsYXRlcy90YXByb290L291dHB1dC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUEsb0JBQW9COzs7QUFFcEIsOEJBQTJDO0FBQzNDLDhCQUFpQztBQUVqQyxTQUFnQixLQUFLLENBQUMsTUFBdUM7SUFDM0QsTUFBTSxNQUFNLEdBQUcsVUFBTyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUV2QyxPQUFPLE1BQU0sQ0FBQyxNQUFNLEtBQUssRUFBRSxJQUFJLE1BQU0sQ0FBQyxDQUFDLENBQUMsS0FBSyxXQUFPLENBQUMsSUFBSSxJQUFJLE1BQU0sQ0FBQyxDQUFDLENBQUMsS0FBSyxJQUFJLENBQUM7QUFDbEYsQ0FBQztBQUpELHNCQUlDO0FBQ0QsS0FBSyxDQUFDLE1BQU0sR0FBRyxHQUFXLEVBQUU7SUFDMUIsT0FBTyxnQkFBZ0IsQ0FBQztBQUMxQixDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvLyBPUF8xIHtzY3JpcHRIYXNofVxuXG5pbXBvcnQgeyBzY3JpcHQgYXMgYnNjcmlwdCB9IGZyb20gJy4uLy4uLyc7XG5pbXBvcnQgeyBvcGNvZGVzIH0gZnJvbSAnLi4vLi4vJztcblxuZXhwb3J0IGZ1bmN0aW9uIGNoZWNrKHNjcmlwdDogQnVmZmVyIHwgQXJyYXk8bnVtYmVyIHwgQnVmZmVyPik6IGJvb2xlYW4ge1xuICBjb25zdCBidWZmZXIgPSBic2NyaXB0LmNvbXBpbGUoc2NyaXB0KTtcblxuICByZXR1cm4gYnVmZmVyLmxlbmd0aCA9PT0gMzQgJiYgYnVmZmVyWzBdID09PSBvcGNvZGVzLk9QXzEgJiYgYnVmZmVyWzFdID09PSAweDIwO1xufVxuY2hlY2sudG9KU09OID0gKCk6IHN0cmluZyA9PiB7XG4gIHJldHVybiAnVGFwcm9vdCBvdXRwdXQnO1xufTtcbiJdfQ==