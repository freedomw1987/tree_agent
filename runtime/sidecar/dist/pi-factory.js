import { SessionManager, createAgentSession } from "@earendil-works/pi-coding-agent";
function wrap(session) {
    return {
        sessionId: session.sessionId,
        sessionFile: session.sessionFile,
        prompt: (text) => session.prompt(text),
        subscribe: (cb) => session.subscribe(cb),
        getLastAssistantText: () => session.getLastAssistantText(),
        dispose: () => session.dispose(),
    };
}
export function createPiFactory(options) {
    return {
        async create({ cwd }) {
            const manager = options?.continueRecent
                ? SessionManager.continueRecent(cwd)
                : SessionManager.create(cwd);
            const { session } = await createAgentSession({ cwd, sessionManager: manager });
            return wrap(session);
        },
        async fork({ cwd, sessionId }) {
            const all = await SessionManager.list(cwd);
            const target = all.find((s) => s.id === sessionId);
            if (!target) {
                throw new Error(`搵唔到 session ${sessionId}（可能已被清理）`);
            }
            const { session } = await createAgentSession({
                cwd,
                sessionManager: SessionManager.open(target.path),
            });
            return wrap(session);
        },
        async list(cwd) {
            const all = await SessionManager.list(cwd);
            return all.map((s) => ({ id: s.id, path: s.path }));
        },
    };
}
