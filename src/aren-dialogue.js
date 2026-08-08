import { ADVENTURE_QUEST } from "./quest-state.js";

const CLOSE_ACTION = "close";

export function arenDialogueModel(progress) {
  const quest = progress.quests[ADVENTURE_QUEST.id];

  switch (quest.status) {
    case "available":
      return {
        title: "현자 아렌",
        body: "외부 지역의 슬라임 세 마리를 처치해 주세요.",
        action: "accept",
        actionLabel: "퀘스트 수락",
      };
    case "active":
      return {
        title: "현자 아렌",
        body: `슬라임 처치 진행 상황: ${quest.progress}/${ADVENTURE_QUEST.required}`,
        action: CLOSE_ACTION,
        actionLabel: "대화 마치기",
      };
    case "ready_to_report":
      return {
        title: "현자 아렌",
        body: "슬라임 세 마리를 모두 처치했군요. 이제 임무를 보고하세요.",
        action: "complete",
        actionLabel: "완료 보고",
      };
    default:
      return {
        title: "현자 아렌",
        body: "훌륭합니다. 계속해서 모험가로서 성장해 나가세요.",
        action: CLOSE_ACTION,
        actionLabel: "대화 마치기",
      };
  }
}
