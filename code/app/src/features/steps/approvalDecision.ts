export const approveWord = "Approve";

export const sendBackWord = "Send back";

export const decisionLabels = { yes_label: approveWord, no_label: sendBackWord };

export const decisionWord = (pick: string) => (pick === "yes" ? approveWord : pick === "no" ? sendBackWord : "Approve or send back");
