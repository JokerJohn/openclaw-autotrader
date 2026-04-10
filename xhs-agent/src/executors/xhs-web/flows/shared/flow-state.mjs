export function appendFlowState(receipt, state, details = {}) {
  receipt.flow_states = receipt.flow_states ?? [];
  receipt.flow_states.push({
    state,
    at: new Date().toISOString(),
    ...details
  });
}
