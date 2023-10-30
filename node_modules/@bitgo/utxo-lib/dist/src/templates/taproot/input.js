"use strict";
// key path spend - {signature}
// script path spend - [...stack elements] {tapscript} {control block}
// https://github.com/bitcoin/bips/blob/master/bip-0341.mediawiki
Object.defineProperty(exports, "__esModule", { value: true });
exports.check = void 0;
const __1 = require("../../");
function check(chunks) {
    try {
        // check whether parsing the witness as a taproot witness fails
        // this indicates whether `chunks` is a valid taproot input
        __1.taproot.parseTaprootWitness(chunks);
        return true;
    }
    catch {
        return false;
    }
}
exports.check = check;
check.toJSON = () => {
    return 'taproot input';
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5wdXQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvdGVtcGxhdGVzL3RhcHJvb3QvaW5wdXQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBLCtCQUErQjtBQUMvQixzRUFBc0U7QUFDdEUsaUVBQWlFOzs7QUFFakUsOEJBQWlDO0FBRWpDLFNBQWdCLEtBQUssQ0FBQyxNQUFnQjtJQUNwQyxJQUFJO1FBQ0YsK0RBQStEO1FBQy9ELDJEQUEyRDtRQUMzRCxXQUFPLENBQUMsbUJBQW1CLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDcEMsT0FBTyxJQUFJLENBQUM7S0FDYjtJQUFDLE1BQU07UUFDTixPQUFPLEtBQUssQ0FBQztLQUNkO0FBQ0gsQ0FBQztBQVRELHNCQVNDO0FBQ0QsS0FBSyxDQUFDLE1BQU0sR0FBRyxHQUFXLEVBQUU7SUFDMUIsT0FBTyxlQUFlLENBQUM7QUFDekIsQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLy8ga2V5IHBhdGggc3BlbmQgLSB7c2lnbmF0dXJlfVxuLy8gc2NyaXB0IHBhdGggc3BlbmQgLSBbLi4uc3RhY2sgZWxlbWVudHNdIHt0YXBzY3JpcHR9IHtjb250cm9sIGJsb2NrfVxuLy8gaHR0cHM6Ly9naXRodWIuY29tL2JpdGNvaW4vYmlwcy9ibG9iL21hc3Rlci9iaXAtMDM0MS5tZWRpYXdpa2lcblxuaW1wb3J0IHsgdGFwcm9vdCB9IGZyb20gJy4uLy4uLyc7XG5cbmV4cG9ydCBmdW5jdGlvbiBjaGVjayhjaHVua3M6IEJ1ZmZlcltdKTogYm9vbGVhbiB7XG4gIHRyeSB7XG4gICAgLy8gY2hlY2sgd2hldGhlciBwYXJzaW5nIHRoZSB3aXRuZXNzIGFzIGEgdGFwcm9vdCB3aXRuZXNzIGZhaWxzXG4gICAgLy8gdGhpcyBpbmRpY2F0ZXMgd2hldGhlciBgY2h1bmtzYCBpcyBhIHZhbGlkIHRhcHJvb3QgaW5wdXRcbiAgICB0YXByb290LnBhcnNlVGFwcm9vdFdpdG5lc3MoY2h1bmtzKTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG59XG5jaGVjay50b0pTT04gPSAoKTogc3RyaW5nID0+IHtcbiAgcmV0dXJuICd0YXByb290IGlucHV0Jztcbn07XG4iXX0=