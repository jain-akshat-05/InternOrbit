import assert from "node:assert/strict";
import test from "node:test";
import { getApiErrorMessage } from "./errors.js";

test("uses the API's validation message for failed requests", () => {
  assert.equal(
    getApiErrorMessage(
      { response: { data: { message: "Invalid email or password" } } },
      "Request failed"
    ),
    "Invalid email or password"
  );
});

test("explains when the browser cannot reach the API", () => {
  assert.match(
    getApiErrorMessage({ request: {} }, "Request failed"),
    /Unable to reach the server/
  );
});

test("reports invalid response errors and falls back for unknown errors", () => {
  assert.equal(
    getApiErrorMessage(new Error("The server returned an unexpected internship response."), "Request failed"),
    "The server returned an unexpected internship response."
  );
  assert.equal(getApiErrorMessage({}, "Request failed"), "Request failed");
});
