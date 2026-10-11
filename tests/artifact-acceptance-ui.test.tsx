// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ArtifactAcceptancePanel } from "@/components/artifacts/ArtifactAcceptancePanel";
import { ArtifactAcceptanceError, type ArtifactAcceptanceReceipt, type ArtifactAcceptanceView } from "@/lib/artifact-acceptance/types";
import { createArtifactAcceptanceMemory, createArtifactAcceptancePageMemory } from "@/lib/artifact-acceptance/client";
const mocks = vi.hoisted(() => ({ get: vi.fn(), accept: vi.fn(), revoke: vi.fn() }));
vi.mock("@/lib/artifact-acceptance/client", async original => ({ ...await original<typeof import("@/lib/artifact-acceptance/client")>(), getArtifactAcceptance: mocks.get, acceptArtifact: mocks.accept, revokeArtifactAcceptance: mocks.revoke }));
const uuid = (n: number) => `10000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
const id = uuid(1), owner = uuid(2), stamp = "2026-10-12T01:02:03.123456+00:00";
function receipt(revoked = false): ArtifactAcceptanceReceipt {
  return { replayed: false, acceptance: { id: uuid(3), userId: owner, artifactId: id, recognitionClass: "USER_CONFIRMED_ARTIFACT", status: revoked ? "REVOKED" : "ACTIVE", acceptedTitle: "验收时标题", acceptedVersion: "1", acceptedUpdatedAt: stamp, acceptanceNote: "检查交付清单", acceptedAt: stamp, earnTransactionId: uuid(4), policyVersion: "artifact-manual-v1", revokedAt: revoked ? stamp : null, revocationReason: revoked ? "有误" : null, correctionTransactionId: revoked ? uuid(6) : null },
    earn: { id: uuid(4), userId: owner, accountId: uuid(5), eventKind: "EARN", amount: 100, sourceType: "ARTIFACT", sourceId: id, policyVersion: "artifact-manual-v1", correctionForId: null, createdAt: stamp },
    correction: revoked ? { id: uuid(6), userId: owner, accountId: uuid(5), eventKind: "CORRECTION", amount: -100, sourceType: "ARTIFACT", sourceId: id, policyVersion: "artifact-manual-v1", correctionForId: uuid(4), createdAt: stamp } : null };
}
function view(value: ArtifactAcceptanceReceipt | null = null): ArtifactAcceptanceView {
  return { artifact: { id, userId: owner, title: "当前标题", version: "2", lifecycleStatus: "active", isArchived: false, updatedAt: stamp }, acceptance: value?.acceptance ?? null, earn: value?.earn ?? null, correction: value?.correction ?? null };
}
function session() { return createArtifactAcceptanceMemory({ owner, pending: null, receipt: null }); }
function panel(memory = session()) { return { ...render(<ArtifactAcceptancePanel artifactId={id} ownerId={owner} session={memory} />), memory }; }
async function open() { fireEvent.click(screen.getByRole("button", { name: "查看／办理用户验收" })); await waitFor(() => expect(screen.queryByText("正在读取验收记录…")).toBeNull()); }
async function acceptance() { fireEvent.change(screen.getByRole("textbox", { name: /验收说明/ }), { target: { value: "  检查交付清单  " } }); fireEvent.click(screen.getByRole("button", { name: "用户验收并领取100积分" })); }
beforeEach(() => {
  vi.clearAllMocks(); let n = 100; vi.stubGlobal("crypto", { randomUUID: vi.fn(() => uuid(n++)) });
  mocks.get.mockResolvedValue(view());
  mocks.accept.mockImplementation(async () => { const r = receipt(); mocks.get.mockResolvedValue(view(r)); return r; });
  mocks.revoke.mockImplementation(async () => { const r = receipt(true); mocks.get.mockResolvedValue(view(r)); return r; });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Artifact panel real React: explicit manual provenance and page-session replay", () => {
  it("external page-session store keeps stable owner/Artifact identity and immutable snapshots", () => {
    const page = createArtifactAcceptancePageMemory(), memory = page.forArtifact(owner, id);
    expect(page.forArtifact(owner, id)).toBe(memory);
    const old = memory.getSnapshot(), listener = vi.fn(), unsubscribe = memory.subscribe(listener);
    memory.update({ ...old, receipt: receipt() });
    expect(old.receipt).toBeNull(); expect(memory.getSnapshot().receipt).toEqual(receipt()); expect(listener).toHaveBeenCalledTimes(1);
    expect(page.forArtifact(uuid(22), id).getSnapshot().receipt).toBeNull();
    expect(page.forArtifact(owner, uuid(23)).getSnapshot().receipt).toBeNull();
    unsubscribe(); memory.update({ ...memory.getSnapshot(), receipt: null }); expect(listener).toHaveBeenCalledTimes(1);
  });
  it("mounted view observes an external saved receipt without manufacturing another attempt", async () => {
    const memory = session(); panel(memory); await open();
    act(() => memory.update({ ...memory.getSnapshot(), receipt: receipt() }));
    expect(screen.getByTestId("artifact-acceptance-saved-receipt")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "用户验收并领取100积分" })).toBeNull(); expect(mocks.accept).not.toHaveBeenCalled();
  });
  it("is lazy until explicitly opened; close/reopen is readonly and no automatic credit", async () => {
    panel(); expect(mocks.get).not.toHaveBeenCalled(); expect(mocks.accept).not.toHaveBeenCalled(); await open();
    expect(mocks.get).toHaveBeenCalledTimes(1); expect(screen.getByText(/不是独立验证或Core核验/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "收起验收记录" })); await open(); expect(mocks.get).toHaveBeenCalledTimes(2); expect(mocks.accept).not.toHaveBeenCalled();
  });
  it("requires an explicit confirmation, preserves raw microseconds and disables duplicate clicks", async () => {
    let finish!: (r: ArtifactAcceptanceReceipt) => void; mocks.accept.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const { memory } = panel(); await open(); await acceptance(); expect(mocks.accept).not.toHaveBeenCalled();
    const button = screen.getByRole("button", { name: "确认验收并领取" }); fireEvent.click(button); fireEvent.click(button);
    await waitFor(() => expect(mocks.accept).toHaveBeenCalledTimes(1));
    expect(mocks.accept.mock.calls[0]).toEqual([id, { requestKey: uuid(100), expectedUpdatedAt: stamp, acceptanceNote: "检查交付清单" }]);
    mocks.get.mockResolvedValue(view(receipt())); await act(async () => finish(receipt()));
    expect(memory.getSnapshot().pending).toBeNull(); expect(memory.getSnapshot().receipt?.earn.amount).toBe(100); expect(screen.queryByRole("button", { name: "用户验收并领取100积分" })).toBeNull();
  });
  it("cancel confirmation has zero business requests", async () => {
    panel(); await open(); await acceptance(); fireEvent.click(screen.getByTestId("confirm-dialog-cancel")); expect(mocks.accept).not.toHaveBeenCalled();
  });
  it.each(["draft", "superseded", "archived"] as const)("%s is read-only for first acceptance", async status => {
    const v = view(); v.artifact.lifecycleStatus = status; v.artifact.isArchived = status === "archived"; mocks.get.mockResolvedValue(v);
    panel(); await open(); expect((screen.getByRole("button", { name: "用户验收并领取100积分" }) as HTMLButtonElement).disabled).toBe(true); expect(mocks.accept).not.toHaveBeenCalled();
  });
  it("rejects excessive note before generating a pending business attempt", async () => {
    const { memory } = panel(); await open(); fireEvent.change(screen.getByRole("textbox"), { target: { value: "x".repeat(2001) } });
    fireEvent.click(screen.getByRole("button", { name: "用户验收并领取100积分" })); fireEvent.click(screen.getByRole("button", { name: "确认验收并领取" }));
    expect(mocks.accept).not.toHaveBeenCalled(); expect(memory.getSnapshot().pending).toBeNull();
  });
  it("unknown network result survives NONE, close/remount and replays the exact original tuple", async () => {
    mocks.accept.mockRejectedValueOnce(new TypeError("Network down")); const memory = session(), first = panel(memory); await open(); await acceptance();
    fireEvent.click(screen.getByRole("button", { name: "确认验收并领取" })); await waitFor(() => expect(screen.getByText(/提交结果不明/)).toBeTruthy());
    const original = structuredClone(memory.getSnapshot().pending!.input); expect(memory.getSnapshot().pending!.unknown).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "重新读取记录" })); await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(2));
    expect(memory.getSnapshot().pending!.input).toEqual(original); expect(screen.queryByRole("button", { name: "用户验收并领取100积分" })).toBeNull();
    first.unmount(); panel(memory); await open(); expect(mocks.accept).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "重放原请求核对" })); await waitFor(() => expect(memory.getSnapshot().pending).toBeNull());
    expect(mocks.accept.mock.calls[1]).toEqual([id, original]); expect(memory.getSnapshot().receipt?.acceptance.status).toBe("ACTIVE");
  });
  it("success receipt remains visible when subsequent read fails; no new business retry", async () => {
    mocks.accept.mockImplementation(async () => { mocks.get.mockRejectedValue(Error("Read failed")); return receipt(); });
    const { memory } = panel(); await open(); await acceptance(); fireEvent.click(screen.getByRole("button", { name: "确认验收并领取" }));
    await waitFor(() => expect(screen.getByText(/已保存的成功回执不受影响/)).toBeTruthy());
    expect(screen.getByTestId("artifact-acceptance-saved-receipt")).toBeTruthy(); expect(memory.getSnapshot().receipt).toEqual(receipt()); expect(memory.getSnapshot().pending).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "重新读取记录" })); expect(mocks.accept).toHaveBeenCalledTimes(1);
  });
  it("success followed by inconsistent NONE fails closed without offering first reward again", async () => {
    mocks.accept.mockResolvedValue(receipt()); panel(); await open(); await acceptance(); fireEvent.click(screen.getByRole("button", { name: "确认验收并领取" }));
    await waitFor(() => expect(screen.getByText(/读取结果与已保存的成功回执不一致/)).toBeTruthy());
    expect(screen.queryByRole("button", { name: "用户验收并领取100积分" })).toBeNull();
  });
  it("clearly separates old accepted version from current version and external correction", async () => {
    const r = receipt(); r.correction = receipt(true).correction; mocks.get.mockResolvedValue(view(r)); panel(); await open();
    expect(screen.getByText(/当前作品：当前标题；当前版本：2/)).toBeTruthy(); expect(screen.getByText(/验收时作品：验收时标题；验收时版本：1/)).toBeTruthy();
    expect(screen.getByText(/已纠正扣回（CORRECTED），不再有效/)).toBeTruthy(); expect(screen.getByText(/USER_CONFIRMED_ARTIFACT/)).toBeTruthy();
  });
  it("revoke requires a reason and confirmation; terminal REVOKED has no re-claim", async () => {
    mocks.get.mockResolvedValue(view(receipt())); const { memory } = panel(); await open();
    expect((screen.getByRole("button", { name: "撤销用户验收" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByRole("textbox", { name: /撤销原因/ }), { target: { value: "有误" } });
    fireEvent.click(screen.getByRole("button", { name: "撤销用户验收" })); expect(mocks.revoke).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "确认撤销" })); await waitFor(() => expect(memory.getSnapshot().receipt?.acceptance.status).toBe("REVOKED"));
    expect(mocks.revoke).toHaveBeenCalledWith(id, { requestKey: uuid(100), reason: "有误" });
    await waitFor(() => expect(screen.getByText(/已撤销，不能重新领奖/)).toBeTruthy()); expect(screen.queryByRole("textbox")).toBeNull();
  });
  it("late reads after unmount cannot populate another Artifact/owner", async () => {
    let resolve!: (v: ArtifactAcceptanceView) => void; mocks.get.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
    const original = panel(); fireEvent.click(screen.getByRole("button", { name: "查看／办理用户验收" })); original.unmount();
    const foreign = createArtifactAcceptanceMemory({ owner: uuid(20), pending: null, receipt: null }); render(<ArtifactAcceptancePanel artifactId={uuid(21)} ownerId={uuid(20)} session={foreign} />);
    await act(async () => resolve(view(receipt()))); expect(screen.queryByText(/验收时标题/)).toBeNull(); expect(foreign.getSnapshot().receipt).toBeNull();
  });
  it("owner mismatch clears old in-memory authority and never dispatches a reward", async () => {
    const v = view(); v.artifact.userId = uuid(22); mocks.get.mockResolvedValue(v); const { memory } = panel(); await open();
    expect(screen.getByText(/登录已过期/)).toBeTruthy(); expect(memory.getSnapshot().owner).toBeNull(); expect(mocks.accept).not.toHaveBeenCalled(); expect(screen.queryByRole("textbox")).toBeNull();
  });
  it("definitive stale rejection can end only that attempt, then requires fresh reading", async () => {
    mocks.accept.mockRejectedValue(new ArtifactAcceptanceError("ARTIFACT_ACCEPTANCE_STALE_SOURCE")); const { memory } = panel(); await open(); await acceptance();
    fireEvent.click(screen.getByRole("button", { name: "确认验收并领取" })); await waitFor(() => expect(memory.getSnapshot().pending?.unknown).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "结束本次未执行的尝试" })); expect(memory.getSnapshot().pending).toBeNull(); expect(screen.queryByRole("button", { name: "用户验收并领取100积分" })).toBeNull();
  });
});
