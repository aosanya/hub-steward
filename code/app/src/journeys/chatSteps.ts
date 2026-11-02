export const chatStepOf = (workflowName: string) => ({
  id: `chat-${workflowName}`,
  title: "Chat with an agent",
  kind: "chat",
  workflow_name: workflowName,
  opens_in: "chat",
  role_name: "Farmer",
  form_name: "",
  questions: [],
});

export const farmerChatSteps = ["Buy inputs", "Sell harvest"].map(chatStepOf);
