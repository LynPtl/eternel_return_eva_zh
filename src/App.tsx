import { Activity, AlertCircle, BarChart3, Brain, Loader2, Swords, Users } from "lucide-react";
import { useMemo, useState } from "react";

interface AnalyzeResponse {
  season: { key: string; name: string };
  players: Array<{
    nickname: string;
    sampleCount: number;
    excludedCobaltCount: number;
    summary: {
      avgRank: number;
      wins: number;
      top3: number;
      kills: number;
      assists: number;
      deaths: number;
      kda: number;
      avgDamageToPlayer: number;
      avgDamageFromPlayer: number;
      avgDamageToMonster: number;
      avgMonsterKill: number;
      avgVisionContribution: number;
      avgCcTime: number;
      avgGainVFCredit: number;
      avgUseVFCredit: number;
    };
    characters: Array<{ characterNum: number; name: string; games: number }>;
    modeSplit: Record<string, number>;
  }>;
  shared: {
    matchCount: number;
    confidence: "high" | "low";
    teamMetricsReliable: boolean;
    avgRank: number | null;
    wins: number | null;
    avgTeamKill: number | null;
    matches: Array<{
      gameId: number;
      startDtm: string;
      mode: string | null;
      rank: number | null;
      teamNumber?: number;
      teamMetricsReliable: boolean;
      participants: Array<{
        nickname: string;
        characterName: string;
        kills: number;
        assists: number;
        deaths: number;
        damageToPlayer: number;
        damageFromPlayer: number;
        viewContribution: number;
        monsterKill: number;
        ccTimeToPlayer: number;
      }>;
    }>;
  };
  comparison: {
    damageLeader: string | null;
    pressureBearer: string | null;
    visionLeader: string | null;
    roleNotes: string[];
  };
  aiReview: string;
  warning?: string;
  error?: string;
}

type PlayerCount = 1 | 2 | 3;

const PLAYER_COUNTS: PlayerCount[] = [1, 2, 3];

export function App() {
  const [playerCount, setPlayerCount] = useState<PlayerCount>(2);
  const [names, setNames] = useState(["Ptlantern", "", ""]);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const activeNames = useMemo(() => names.slice(0, playerCount), [names, playerCount]);
  const trimmedNames = useMemo(() => activeNames.map((name) => name.trim()).filter(Boolean), [activeNames]);
  const canSubmit = trimmedNames.length > 0 && !loading;

  async function submit() {
    if (!canSubmit) return;

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ players: activeNames })
      });
      const data = (await response.json()) as AnalyzeResponse;
      if (!response.ok) throw new Error(data.error ?? "分析失败");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "分析失败");
    } finally {
      setLoading(false);
    }
  }

  function updateName(index: number, value: string) {
    const next = [...names];
    next[index] = value;
    setNames(next);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Eternal Return Team Review</p>
          <h1>永恒轮回组队复盘</h1>
        </div>
        <span className="status-pill">
          <Activity size={14} />
          当前赛季自动识别
        </span>
      </header>

      <section className="input-panel" aria-labelledby="input-title">
        <div className="panel-heading">
          <Users size={20} />
          <div>
            <h2 id="input-title">输入玩家</h2>
            <p>分析最近最多 20 场非钴协议对局，优先识别多人同队表现。</p>
          </div>
        </div>

        <div className="count-switch" aria-label="选择分析人数">
          {PLAYER_COUNTS.map((count) => (
            <button key={count} className={playerCount === count ? "active" : ""} onClick={() => setPlayerCount(count)}>
              {count} 人分析
            </button>
          ))}
        </div>

        <div className="name-grid">
          {activeNames.map((name, index) => (
            <label key={index} className="name-field">
              <span>{index + 1}</span>
              <input
                autoComplete="off"
                value={name}
                placeholder={`玩家昵称 ${index + 1}`}
                onChange={(event) => updateName(index, event.target.value)}
              />
            </label>
          ))}
        </div>

        <button className="primary-button" disabled={!canSubmit} onClick={submit}>
          {loading ? <Loader2 className="spin" size={18} /> : <Brain size={18} />}
          {loading ? "分析中..." : "开始复盘"}
        </button>
        <p className="helper">默认统计普通、排位等主模式，自动排除钴协议；共同对局优先按同局同队识别。</p>
      </section>

      {error && (
        <section className="error-panel" role="alert">
          <AlertCircle size={18} />
          <span>{error}</span>
        </section>
      )}

      {loading && (
        <section className="loading-panel" aria-live="polite">
          <Loader2 className="spin" size={20} />
          正在获取对局、识别共同样本并生成复盘...
        </section>
      )}

      {result && <Results result={result} />}
    </main>
  );
}

function Results({ result }: { result: AnalyzeResponse }) {
  const sharedReliable = result.shared.teamMetricsReliable;

  return (
    <section className="results" aria-label="分析结果">
      <div className="summary-strip">
        <Metric label="赛季" value={result.season.name} />
        <Metric label="共同对局" value={`${result.shared.matchCount} 场`} />
        <Metric label="识别置信度" value={result.shared.confidence === "high" ? "同局同队" : "仅同局"} />
        <Metric label="共同均名次" value={sharedReliable ? formatNullable(result.shared.avgRank) : "置信不足"} muted={!sharedReliable} />
      </div>

      <section className="result-card primary">
        <div className="section-title">
          <Swords size={18} />
          <h2>共同对局分析</h2>
        </div>

        {result.shared.matchCount === 0 ? (
          <p className="muted">最近样本里没有识别到共同非钴协议对局，因此只展示个人近况。</p>
        ) : (
          <>
            {!sharedReliable && (
              <p className="confidence-note">
                共同样本只确认到同一局，队伍名次、吃鸡数和队伍击杀置信不足；下方仅展示可确认的个人表现。
              </p>
            )}

            <div className="shared-metrics">
              <Metric label="共同吃鸡" value={sharedReliable ? `${formatNullable(result.shared.wins)} 场` : "置信不足"} muted={!sharedReliable} />
              <Metric
                label="平均队伍击杀"
                value={sharedReliable ? formatNullable(result.shared.avgTeamKill) : "置信不足"}
                muted={!sharedReliable}
              />
              <Metric label="样本质量" value={sharedReliable ? "可用于团队指标" : "仅用于个人对比"} muted={!sharedReliable} />
            </div>

            <div className="match-list">
              {result.shared.matches.slice(0, 8).map((match) => (
                <article key={match.gameId} className="match-row">
                  <div className="match-meta">
                    <strong>{match.teamMetricsReliable && match.rank !== null ? `#${match.rank}` : "同局"}</strong>
                    <span>{match.teamMetricsReliable ? (match.mode ?? "未知模式") : "队伍未确认"}</span>
                  </div>
                  <div className="participant-grid">
                    {match.participants.map((player) => (
                      <span key={player.nickname}>
                        <b>{player.nickname}</b> · {player.characterName} · {player.kills}/{player.assists}/{player.deaths} ·{" "}
                        {formatNumber(player.damageToPlayer)} 伤害 · {formatNumber(player.viewContribution)} 视野
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="result-card">
        <div className="section-title">
          <BarChart3 size={18} />
          <h2>玩家对比</h2>
        </div>

        <div className="leader-row">
          <Metric label="主要输出" value={result.comparison.damageLeader ?? "样本不足"} muted={!result.comparison.damageLeader} />
          <Metric label="主要承压" value={result.comparison.pressureBearer ?? "样本不足"} muted={!result.comparison.pressureBearer} />
          <Metric label="视野最高" value={result.comparison.visionLeader ?? "样本不足"} muted={!result.comparison.visionLeader} />
        </div>

        <div className="player-grid">
          {result.players.map((player) => (
            <article className="player-card" key={player.nickname}>
              <div className="player-card-header">
                <h3>{player.nickname}</h3>
                <span>{player.sampleCount} 场</span>
              </div>
              <p className="muted">排除钴协议 {player.excludedCobaltCount} 场</p>

              <div className="mini-metrics">
                <Metric label="均名次" value={player.summary.avgRank} />
                <Metric label="胜场/前三" value={`${player.summary.wins}/${player.summary.top3}`} />
                <Metric label="KDA" value={player.summary.kda} />
                <Metric label="均伤害" value={formatNumber(Math.round(player.summary.avgDamageToPlayer))} />
                <Metric label="均承伤" value={formatNumber(Math.round(player.summary.avgDamageFromPlayer))} />
                <Metric label="均视野" value={formatNumber(Math.round(player.summary.avgVisionContribution))} />
              </div>

              <p className="muted">常用角色：{formatCharacters(player.characters)}</p>
            </article>
          ))}
        </div>

        <ul className="role-notes">
          {result.comparison.roleNotes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </section>

      <section className="result-card ai-card">
        <div className="section-title">
          <Brain size={18} />
          <h2>AI 复盘</h2>
        </div>
        {result.warning && <p className="warning">{result.warning}</p>}
        <p className="ai-text">{result.aiReview || "AI 复盘暂不可用，规则指标已展示。"}</p>
      </section>
    </section>
  );
}

function Metric({ label, value, muted = false }: { label: string; value: string | number; muted?: boolean }) {
  return (
    <div className={muted ? "metric muted-metric" : "metric"}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatNullable(value: number | null): string {
  return value === null ? "无可靠数据" : String(value);
}

function formatNumber(value: number): string {
  return value.toLocaleString("zh-CN");
}

function formatCharacters(characters: Array<{ name: string; games: number }>): string {
  const topCharacters = characters.slice(0, 3).map((item) => `${item.name} ${item.games} 场`);
  return topCharacters.length > 0 ? topCharacters.join(" / ") : "-";
}
