import type { Course } from "../content";

import { calculus1 } from "./calculus-1";
import { calculus1Self } from "./calculus-1-self";
// clone:imports — `npm run course:clone` 이 이 줄 위에 강좌 import 를 추가합니다. (직접 수정 가능)

/**
 * 추가 강좌 등록소.
 *
 * `npm run course:clone -- --id <새-id> --title "<제목>"` 으로 시드 강좌를 복제하면
 * 이 폴더에 `<새-id>.ts` 파일이 생기고 아래 배열에 자동 등록됩니다.
 * 여기 등록된 강좌는 시드 강좌(ai-linalg)와 완전히 동일한 메뉴·기능을 가지며,
 * 수강생·게시글·댓글·시험 등 기록물은 새 강좌 id 기준으로 처음부터 비어 있습니다.
 * 기본 상태는 비공개(private) 이므로 관리자에게만 보입니다.
 */
export const EXTRA_COURSES: Course[] = [
  calculus1,
  calculus1Self,
  // clone:register — 생성기가 이 줄 위에 강좌를 추가합니다. (직접 수정 가능)
];
