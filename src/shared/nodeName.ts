/** A display remark never replaces the numeric identity of a node. */
export const normalizeNodeName = (name: string, nodeId: number): string => name.trim() || `Node-${nodeId}`
