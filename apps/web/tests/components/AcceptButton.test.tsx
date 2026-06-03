// @vitest-environment jsdom

/**
 * AcceptButton component tests — UAT gap closure Test 7 (WS-03)
 *
 * Tests prove:
 * 1. AcceptButton renders the "Accept invitation" button in idle state.
 * 2. Clicking the button calls acceptInvitationAction with the invitationId.
 * 3. When acceptInvitationAction returns {ok:false, error}, the error is shown
 *    in a visible role="alert" element.
 * 4. The error message does NOT mention whether the invited email is registered
 *    (privacy: user enumeration prevention, T-02-07-02).
 *
 * Environment: jsdom (component test — requires browser-like DOM).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AcceptButton } from "../../src/app/invitations/[id]/AcceptButton";

// Mock the server action — this is a "use server" function imported by a client component.
// Vitest resolves the import; we mock the module to control the return value.
vi.mock("@/lib/workspaces/actions", () => ({
  acceptInvitationAction: vi.fn(),
}));

// Import the mock so we can configure return values per test.
import { acceptInvitationAction } from "@/lib/workspaces/actions";

const mockAcceptAction = acceptInvitationAction as ReturnType<typeof vi.fn>;

describe("AcceptButton — invitation accept UI (UAT Test 7, WS-03)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the Accept invitation button in idle state", () => {
    render(<AcceptButton invitationId="test-inv-id" />);

    const button = screen.getByRole("button", { name: /accept invitation/i });
    expect(button).toBeDefined();
    expect(button.hasAttribute("disabled")).toBe(false);
  });

  it("renders no error alert in idle state", () => {
    render(<AcceptButton invitationId="test-inv-id" />);

    const alert = screen.queryByRole("alert");
    expect(alert).toBeNull();
  });

  it("shows error alert when acceptInvitationAction returns {ok:false}", async () => {
    mockAcceptAction.mockResolvedValueOnce({
      ok: false,
      error: "This invitation was issued to a different email address.",
    });

    render(<AcceptButton invitationId="test-inv-id" />);

    const button = screen.getByRole("button", { name: /accept invitation/i });
    fireEvent.click(button);

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert).toBeDefined();
      expect(alert.textContent).toContain(
        "This invitation was issued to a different email address."
      );
    });
  });

  it("calls acceptInvitationAction with the correct invitationId", async () => {
    mockAcceptAction.mockResolvedValueOnce({
      ok: false,
      error: "This invitation was issued to a different email address.",
    });

    render(<AcceptButton invitationId="my-invitation-id" />);

    const button = screen.getByRole("button", { name: /accept invitation/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockAcceptAction).toHaveBeenCalledWith("my-invitation-id");
    });
  });

  it("error message does not reveal whether the invited email is registered (T-02-07-02)", async () => {
    const ERROR_MSG = "This invitation was issued to a different email address.";
    mockAcceptAction.mockResolvedValueOnce({ ok: false, error: ERROR_MSG });

    render(<AcceptButton invitationId="test-inv-id" />);
    fireEvent.click(screen.getByRole("button", { name: /accept invitation/i }));

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      // Must not contain words that indicate whether the email is a registered account
      expect(alert.textContent).not.toMatch(/register/i);
      expect(alert.textContent).not.toMatch(/account exist/i);
      expect(alert.textContent).not.toMatch(/not found/i);
    });
  });
});
