/**
 * A request kit can't carry out, with a message written for a designer ("There's already a
 * screen called checkout.review."). The CLI prints it and exits 1; the MCP server returns it
 * as a tool error.
 */
export class KitError extends Error {
  override name = "KitError";
}
