import { useState, useEffect } from "react";
import { db } from "./firebase";
import { ref, onValue, set, remove, push, update } from "firebase/database";

// ─── 상수 ───────────────────────────────────────────────
const TIME_SLOTS = [
  "06:00","06:30","07:00","07:30","08:00","08:30",
  "09:00","09:30","10:00","10:30","11:00","11:30",
  "12:00","12:30","13:00","13:30","14:00","14:30",
  "15:00","15:30","16:00","16:30","17:00","17:30",
  "18:00","18:30","19:00","19:30","20:00","20:30",
  "21:00","21:30","22:00","22:30","23:00","23:30",
  "24:00",
];

const STATUS_COLORS = {
  confirmed: { bg:"#d1fae5", text:"#065f46", border:"#6ee7b7", label:"확정" },
  pending:   { bg:"#fef3c7", text:"#92400e", border:"#fcd34d", label:"대기" },
  none:      { bg:"#f1f5f9", text:"#94a3b8", border:"#e2e8f0", label:"미등록" },
};

// ─── 날짜 유틸 ──────────────────────────────────────────
function getToday() { return new Date().toISOString().split("T")[0]; }
function formatDate(dateStr) {
  const d = new Date(dateStr);
  const days = ["일","월","화","수","목","금","토"];
  return `${d.getMonth()+1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
}
function toMinutes(t) { const [h,m]=t.split(":").map(Number); return h*60+m; }

// ─── 미니 달력 ──────────────────────────────────────────
function MiniCalendar({ selectedDate, onSelect, schedules, driverId }) {
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date(selectedDate);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const today = getToday();
  const year = calMonth.getFullYear();
  const month = calMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const cells = [];
  for (let i=0;i<firstDay;i++) cells.push(null);
  for (let d=1;d<=daysInMonth;d++) cells.push(d);
  const fmt = (d) => `${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  const dayLabels = ["일","월","화","수","목","금","토"];

  return (
    <div style={{ background:"#1e293b", borderRadius:16, padding:16, marginBottom:16 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
        <button onClick={() => setCalMonth(new Date(year, month-1, 1))}
          style={{ background:"#0f172a", border:"none", color:"#94a3b8", borderRadius:8, width:30, height:30, fontSize:16, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>‹</button>
        <div style={{ fontWeight:800, fontSize:15, color:"#f8fafc" }}>{year}년 {month+1}월</div>
        <button onClick={() => setCalMonth(new Date(year, month+1, 1))}
          style={{ background:"#0f172a", border:"none", color:"#94a3b8", borderRadius:8, width:30, height:30, fontSize:16, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>›</button>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2, marginBottom:4 }}>
        {dayLabels.map((d,i) => (
          <div key={d} style={{ textAlign:"center", fontSize:11, fontWeight:700, color: i===0?"#f87171":i===6?"#60a5fa":"#475569", padding:"4px 0" }}>{d}</div>
        ))}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2 }}>
        {cells.map((d, i) => {
          if (!d) return <div key={`e${i}`} />;
          const dateStr = fmt(d);
          const isPast = new Date(dateStr) < new Date(new Date(today).toDateString());
          const isToday = dateStr === today;
          const isSelected = dateStr === selectedDate;
          const hasSched = driverId && schedules[`${driverId}_${dateStr}`];
          const isConf = hasSched?.status === "confirmed";
          const dow = (firstDay+d-1)%7;
          return (
            <button key={d} onClick={() => { if (!isPast) onSelect(dateStr); }} disabled={isPast}
              style={{ position:"relative", padding:"8px 2px", borderRadius:9, border:"none",
                cursor: isPast?"default":"pointer",
                background: isSelected?"linear-gradient(135deg,#3b82f6,#6366f1)":isToday?"#1e3a5f":"transparent",
                color: isPast?"#2d3f55":isSelected?"#fff":dow===0?"#f87171":dow===6?"#60a5fa":"#e2e8f0",
                fontWeight: isSelected||isToday?800:500, fontSize:13,
                boxShadow: isSelected?"0 2px 10px rgba(99,102,241,0.4)":"none", transition:"all 0.15s" }}>
              {d}
              {hasSched && !isSelected && (
                <div style={{ position:"absolute", bottom:2, left:"50%", transform:"translateX(-50%)", width:4, height:4, borderRadius:"50%", background: isConf?"#34d399":"#fbbf24" }} />
              )}
            </button>
          );
        })}
      </div>
      <div style={{ display:"flex", gap:12, marginTop:12, paddingTop:10, borderTop:"1px solid #334155" }}>
        <div style={{ fontSize:11, color:"#475569", display:"flex", alignItems:"center", gap:4 }}>
          <div style={{ width:6, height:6, borderRadius:"50%", background:"#34d399" }} />확정됨
        </div>
        <div style={{ fontSize:11, color:"#475569", display:"flex", alignItems:"center", gap:4 }}>
          <div style={{ width:6, height:6, borderRadius:"50%", background:"#fbbf24" }} />대기중
        </div>
      </div>
    </div>
  );
}

// ─── 메인 앱 ────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState("select");
  const [drivers, setDrivers] = useState([]);
  const [schedules, setSchedules] = useState({});
  const [loading, setLoading] = useState(true);

  const [selectedDriver, setSelectedDriver] = useState(null);
  const [driverDate, setDriverDate] = useState(getToday());
  const [showSuccess, setShowSuccess] = useState(false);

  const [managerDate, setManagerDate] = useState(getToday());
  const [managerTab, setManagerTab] = useState("schedule");
  const [calOpen, setCalOpen] = useState(false);

  // 기사 관리
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [newName, setNewName] = useState("");
  const [showAddInput, setShowAddInput] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const today = getToday();

  // ── Firebase 실시간 구독 ──
  useEffect(() => {
    // 기사 목록 구독
    const driversRef = ref(db, "drivers");
    const unsubDrivers = onValue(driversRef, (snap) => {
      const data = snap.val();
      if (data) {
        const list = Object.entries(data).map(([id, val]) => ({ id, ...val }));
        list.sort((a, b) => a.order - b.order);
        setDrivers(list);
      } else {
        // 최초 실행 시 기본 기사 데이터 삽입
        const defaults = ["김철수","이영호","박민준","최동현","정성훈","강태양","윤재원","임수진","한지훈","오병철"];
        defaults.forEach((name, i) => {
          const newRef = push(ref(db, "drivers"));
          set(newRef, { name, order: i });
        });
      }
      setLoading(false);
    });

    // 일정 구독
    const schedRef = ref(db, "schedules");
    const unsubSched = onValue(schedRef, (snap) => {
      setSchedules(snap.val() || {});
    });

    return () => { unsubDrivers(); unsubSched(); };
  }, []);

  // ── 일정 CRUD ──
  const setSchedule = (driverId, date, time) => {
    const key = `${driverId}_${date}`;
    set(ref(db, `schedules/${key}`), { time, status: "pending", driverId, date });
  };
  const confirmSchedule = (driverId, date) => {
    const key = `${driverId}_${date}`;
    update(ref(db, `schedules/${key}`), { status: "confirmed" });
  };
  const removeSchedule = (driverId, date) => {
    remove(ref(db, `schedules/${driverId}_${date}`));
  };

  // ── 기사 CRUD ──
  const addDriver = () => {
    const name = newName.trim();
    if (!name) return;
    const newRef = push(ref(db, "drivers"));
    set(newRef, { name, order: drivers.length });
    setNewName(""); setShowAddInput(false);
  };
  const saveEdit = () => {
    const name = editingName.trim();
    if (!name) return;
    update(ref(db, `drivers/${editingId}`), { name });
    setEditingId(null); setEditingName("");
  };
  const deleteDriver = (id) => {
    remove(ref(db, `drivers/${id}`));
    // 해당 기사 일정 삭제
    Object.keys(schedules).forEach(key => {
      if (schedules[key].driverId === id) remove(ref(db, `schedules/${key}`));
    });
    setDeleteConfirmId(null);
  };

  // ── 파생 데이터 ──
  const managerSchedules = drivers.map(d => ({
    driver: d,
    schedule: schedules[`${d.id}_${managerDate}`] || null,
  }));
  const confirmedCount = managerSchedules.filter(s => s.schedule?.status==="confirmed").length;
  const pendingCount = managerSchedules.filter(s => s.schedule?.status==="pending").length;
  const sortedSchedules = [...managerSchedules].sort((a,b) => {
    if (!a.schedule) return 1; if (!b.schedule) return -1;
    return a.schedule.time.localeCompare(b.schedule.time);
  });

  // ── 로딩 화면 ──
  if (loading) return (
    <div style={{ minHeight:"100vh", background:"#0f172a", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:16 }}>
      <div style={{ width:40, height:40, border:"3px solid #1e293b", borderTop:"3px solid #3b82f6", borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />
      <div style={{ color:"#64748b", fontSize:14 }}>데이터 불러오는 중...</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:"#0f172a", fontFamily:"'Pretendard','Apple SD Gothic Neo',sans-serif", color:"#f8fafc" }}>

      {/* ── 헤더 ── */}
      <div style={{ background:"linear-gradient(135deg,#1e293b 0%,#0f172a 100%)", borderBottom:"1px solid #1e293b", padding:"16px 20px", display:"flex", alignItems:"center", gap:12, position:"sticky", top:0, zIndex:100 }}>
        <div style={{ width:36, height:36, background:"linear-gradient(135deg,#3b82f6,#6366f1)", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>🚛</div>
        <div>
          <div style={{ fontWeight:800, fontSize:17, letterSpacing:"-0.3px" }}>창고 출입 관리</div>
          <div style={{ fontSize:12, color:"#64748b", marginTop:1 }}>가구 배달 일정 시스템</div>
        </div>
        {view !== "select" && (
          <button onClick={() => { setView("select"); setEditingId(null); setDeleteConfirmId(null); setShowAddInput(false); }}
            style={{ marginLeft:"auto", background:"#1e293b", border:"1px solid #334155", color:"#94a3b8", borderRadius:8, padding:"6px 12px", fontSize:13, cursor:"pointer" }}>
            ← 홈
          </button>
        )}
      </div>

      <div style={{ maxWidth:480, margin:"0 auto", padding:"20px 16px" }}>

        {/* ── 홈 ── */}
        {view === "select" && (
          <div>
            <div style={{ textAlign:"center", marginBottom:32, marginTop:12 }}>
              <div style={{ fontSize:28, fontWeight:900, letterSpacing:"-0.5px" }}>어떤 화면으로<br/>이동할까요?</div>
              <div style={{ color:"#64748b", fontSize:14, marginTop:8 }}>역할을 선택해주세요</div>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <button onClick={() => setView("driver-select")}
                style={{ background:"linear-gradient(135deg,#3b82f6 0%,#2563eb 100%)", border:"none", borderRadius:16, padding:"24px 20px", color:"#fff", cursor:"pointer", textAlign:"left", boxShadow:"0 4px 24px rgba(59,130,246,0.3)" }}>
                <div style={{ fontSize:32, marginBottom:8 }}>🚛</div>
                <div style={{ fontWeight:800, fontSize:20 }}>기사 화면</div>
                <div style={{ fontSize:13, opacity:0.8, marginTop:4 }}>오늘/내일 창고 도착 시간 등록</div>
              </button>
              <button onClick={() => setView("manager")}
                style={{ background:"linear-gradient(135deg,#8b5cf6 0%,#6d28d9 100%)", border:"none", borderRadius:16, padding:"24px 20px", color:"#fff", cursor:"pointer", textAlign:"left", boxShadow:"0 4px 24px rgba(139,92,246,0.3)" }}>
                <div style={{ fontSize:32, marginBottom:8 }}>📋</div>
                <div style={{ fontWeight:800, fontSize:20 }}>관리자 화면</div>
                <div style={{ fontSize:13, opacity:0.8, marginTop:4 }}>전체 기사 출입 일정 한눈에 보기</div>
              </button>
            </div>
          </div>
        )}

        {/* ── 기사 선택 ── */}
        {view === "driver-select" && (
          <div>
            <div style={{ marginBottom:24 }}>
              <div style={{ fontSize:22, fontWeight:800 }}>기사 선택</div>
              <div style={{ color:"#64748b", fontSize:14, marginTop:4 }}>본인 이름을 선택하세요</div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              {drivers.map(d => {
                const ts = schedules[`${d.id}_${today}`];
                const tms = schedules[`${d.id}_${new Date(new Date().setDate(new Date().getDate()+1)).toISOString().split("T")[0]}`];
                return (
                  <button key={d.id} onClick={() => { setSelectedDriver(d); setDriverDate(today); setView("driver"); }}
                    style={{ background:"#1e293b", border:"1px solid #334155", borderRadius:14, padding:"16px 14px", cursor:"pointer", textAlign:"left" }}>
                    <div style={{ fontWeight:700, fontSize:16, color:"#f8fafc" }}>{d.name}</div>
                    <div style={{ marginTop:8, display:"flex", flexDirection:"column", gap:3 }}>
                      <div style={{ fontSize:11, color: ts?"#34d399":"#475569" }}>오늘: {ts?`${ts.time}${ts.status==="confirmed"?" ✓":""}`:"미등록"}</div>
                      <div style={{ fontSize:11, color: tms?"#60a5fa":"#475569" }}>내일: {tms?`${tms.time}${tms.status==="confirmed"?" ✓":""}`:"미등록"}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── 기사 시간 등록 ── */}
        {view === "driver" && selectedDriver && (
          <div>
            {showSuccess && (
              <div style={{ background:"linear-gradient(135deg,#065f46,#047857)", borderRadius:12, padding:"14px 16px", marginBottom:16, display:"flex", alignItems:"center", gap:10, animation:"fadeIn 0.3s ease" }}>
                <span style={{ fontSize:20 }}>✅</span>
                <div>
                  <div style={{ fontWeight:700, fontSize:14 }}>등록 완료!</div>
                  <div style={{ fontSize:12, opacity:0.8, marginTop:2 }}>관리자에게 실시간 전달됩니다</div>
                </div>
              </div>
            )}
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:22, fontWeight:800 }}>{selectedDriver.name} 기사님</div>
              <div style={{ color:"#64748b", fontSize:14, marginTop:4 }}>날짜를 선택하고 도착 시간을 등록하세요</div>
            </div>

            <MiniCalendar
              selectedDate={driverDate}
              onSelect={setDriverDate}
              schedules={schedules}
              driverId={selectedDriver.id}
            />

            {/* 현재 등록된 시간 */}
            {(() => {
              const sched = schedules[`${selectedDriver.id}_${driverDate}`];
              return sched ? (
                <div style={{ background: sched.status==="confirmed"?"linear-gradient(135deg,#065f46,#047857)":"linear-gradient(135deg,#78350f,#92400e)", borderRadius:14, padding:16, marginBottom:16 }}>
                  <div style={{ fontSize:12, opacity:0.8 }}>{formatDate(driverDate)} 등록된 시간</div>
                  <div style={{ fontSize:28, fontWeight:900, marginTop:4 }}>{sched.time}</div>
                  <div style={{ fontSize:12, marginTop:6, opacity:0.9 }}>{sched.status==="confirmed"?"✓ 관리자 확인 완료":"⏳ 관리자 확인 대기 중"}</div>
                  <button onClick={() => removeSchedule(selectedDriver.id, driverDate)}
                    style={{ marginTop:10, background:"rgba(0,0,0,0.3)", border:"none", color:"#fff", borderRadius:8, padding:"6px 12px", fontSize:12, cursor:"pointer" }}>취소하기</button>
                </div>
              ) : null;
            })()}

            {/* 시간 선택 그리드 */}
            <div style={{ background:"#1e293b", borderRadius:16, padding:16 }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
                <div style={{ fontSize:13, fontWeight:700, color:"#94a3b8" }}>도착 시간 선택</div>
                <div style={{ fontSize:12, fontWeight:700, color:"#60a5fa", background:"#1e3a5f", borderRadius:8, padding:"3px 10px" }}>{formatDate(driverDate)}</div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>
                {TIME_SLOTS.map(t => {
                  const sched = schedules[`${selectedDriver.id}_${driverDate}`];
                  const isSel = sched?.time === t;
                  return (
                    <button key={t} onClick={() => { setSchedule(selectedDriver.id, driverDate, t); setShowSuccess(true); setTimeout(()=>setShowSuccess(false),3000); }}
                      style={{ padding:"10px 4px", borderRadius:10, border:"none", cursor:"pointer", background: isSel?"#3b82f6":"#0f172a", color: isSel?"#fff":"#94a3b8", fontWeight: isSel?700:500, fontSize:13, boxShadow: isSel?"0 0 0 2px #60a5fa":"none", transition:"all 0.15s" }}>
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── 관리자 ── */}
        {view === "manager" && (
          <div>
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:22, fontWeight:800 }}>관리자 대시보드</div>
              <div style={{ color:"#64748b", fontSize:14, marginTop:4 }}>전체 기사 출입 일정 · 실시간</div>
            </div>

            {/* 탭 */}
            <div style={{ display:"flex", gap:8, marginBottom:20, background:"#1e293b", borderRadius:12, padding:4 }}>
              {[{key:"schedule",label:"📅 일정 현황"},{key:"drivers",label:"👥 기사 관리"}].map(tab => (
                <button key={tab.key} onClick={() => { setManagerTab(tab.key); setEditingId(null); setDeleteConfirmId(null); setShowAddInput(false); }}
                  style={{ flex:1, padding:"10px 8px", borderRadius:9, border:"none", background: managerTab===tab.key?"#8b5cf6":"transparent", color: managerTab===tab.key?"#fff":"#64748b", fontWeight:700, fontSize:13, cursor:"pointer", transition:"all 0.2s" }}>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ── 일정 현황 탭 ── */}
            {managerTab === "schedule" && (
              <div>
                {/* 날짜 달력 */}
                <div style={{ marginBottom:16 }}>
                  <button onClick={() => setCalOpen(v => !v)}
                    style={{ width:"100%", background:"#1e293b", border:"1px solid #334155", color:"#f8fafc", borderRadius:12, padding:"12px 16px", fontSize:14, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                    <span>📅 {formatDate(managerDate)}</span>
                    <span style={{ color:"#64748b" }}>{calOpen?"▲":"▼"}</span>
                  </button>
                  {calOpen && (
                    <div style={{ marginTop:8 }}>
                      <MiniCalendar selectedDate={managerDate} onSelect={(d) => { setManagerDate(d); setCalOpen(false); }} schedules={{}} driverId={null} />
                    </div>
                  )}
                </div>

                {/* 통계 */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:20 }}>
                  {[
                    {label:"확정",value:confirmedCount,color:"#34d399",bg:"#064e3b"},
                    {label:"대기",value:pendingCount,color:"#fbbf24",bg:"#78350f"},
                    {label:"미등록",value:drivers.length-confirmedCount-pendingCount,color:"#64748b",bg:"#1e293b"},
                  ].map(stat => (
                    <div key={stat.label} style={{ background:stat.bg, borderRadius:14, padding:"14px 12px", textAlign:"center" }}>
                      <div style={{ fontSize:28, fontWeight:900, color:stat.color }}>{stat.value}</div>
                      <div style={{ fontSize:12, color:stat.color, opacity:0.8, marginTop:2 }}>{stat.label}</div>
                    </div>
                  ))}
                </div>

                {/* 기사 목록 */}
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {sortedSchedules.map(({ driver, schedule }) => {
                    const status = schedule ? schedule.status : "none";
                    const sc = STATUS_COLORS[status];
                    return (
                      <div key={driver.id} style={{ background:"#1e293b", borderRadius:14, padding:"14px 16px", display:"flex", alignItems:"center", gap:12, borderLeft:`4px solid ${sc.border}` }}>
                        <div style={{ width:40, height:40, borderRadius:12, background:sc.bg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>🚛</div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontWeight:700, fontSize:15 }}>{driver.name}</div>
                          <div style={{ fontSize:13, color:"#64748b", marginTop:2 }}>{schedule?`도착 예정: ${schedule.time}`:"아직 등록 안 함"}</div>
                        </div>
                        <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:6 }}>
                          <div style={{ background:sc.bg, color:sc.text, borderRadius:8, padding:"3px 10px", fontSize:12, fontWeight:700 }}>{sc.label}</div>
                          {schedule && status==="pending" && (
                            <button onClick={() => confirmSchedule(driver.id, managerDate)}
                              style={{ background:"#065f46", border:"none", color:"#34d399", borderRadius:8, padding:"4px 10px", fontSize:12, fontWeight:700, cursor:"pointer" }}>확정 ✓</button>
                          )}
                          {schedule && status==="confirmed" && <span style={{ fontSize:18 }}>✅</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 시각화 타임라인 */}
                {(() => {
                  const scheduled = managerSchedules.filter(s => s.schedule);
                  if (scheduled.length === 0) return (
                    <div style={{ marginTop:24, background:"#1e293b", borderRadius:16, padding:24, textAlign:"center", color:"#475569" }}>
                      <div style={{ fontSize:32, marginBottom:8 }}>📭</div>
                      <div style={{ fontSize:14 }}>아직 등록된 기사가 없습니다</div>
                    </div>
                  );
                  const allTimes = scheduled.map(s => s.schedule.time);
                  const minTime = Math.min(...allTimes.map(toMinutes));
                  const maxTime = Math.max(...allTimes.map(toMinutes));
                  const rangeStart = Math.max(minTime-30, toMinutes("06:00"));
                  const rangeEnd = Math.min(maxTime+30, toMinutes("24:00"));
                  const totalRange = rangeEnd-rangeStart || 60;
                  const ticks = [];
                  for (let m=Math.ceil(rangeStart/60)*60; m<=rangeEnd; m+=60) ticks.push(m);
                  const byTime = {};
                  scheduled.forEach(({ driver, schedule }) => {
                    if (!byTime[schedule.time]) byTime[schedule.time] = [];
                    byTime[schedule.time].push({ driver, schedule });
                  });
                  return (
                    <div style={{ marginTop:24 }}>
                      <div style={{ background:"#1e293b", borderRadius:16, padding:20, marginBottom:14 }}>
                        <div style={{ fontSize:13, fontWeight:700, color:"#94a3b8", marginBottom:18 }}>📍 시간대별 기사 현황</div>
                        <div style={{ position:"relative", marginBottom:8, paddingLeft:52 }}>
                          <div style={{ position:"relative", height:20 }}>
                            {ticks.map(m => {
                              const pct=((m-rangeStart)/totalRange)*100;
                              return <div key={m} style={{ position:"absolute", left:`${pct}%`, transform:"translateX(-50%)", fontSize:11, color:"#475569", fontWeight:600 }}>{Math.floor(m/60)}시</div>;
                            })}
                          </div>
                        </div>
                        <div style={{ position:"relative", paddingLeft:52 }}>
                          <div style={{ position:"absolute", top:0, bottom:0, left:52, right:0, pointerEvents:"none" }}>
                            {ticks.map(m => { const pct=((m-rangeStart)/totalRange)*100; return <div key={m} style={{ position:"absolute", left:`${pct}%`, top:0, bottom:0, width:1, background:"#334155" }} />; })}
                          </div>
                          {managerSchedules.map(({ driver, schedule }) => {
                            const has = !!schedule;
                            const pct = has?((toMinutes(schedule.time)-rangeStart)/totalRange)*100:null;
                            const isConf = schedule?.status==="confirmed";
                            return (
                              <div key={driver.id} style={{ display:"flex", alignItems:"center", marginBottom:8 }}>
                                <div style={{ width:48, flexShrink:0, fontSize:12, fontWeight:700, color: has?"#e2e8f0":"#334155", textAlign:"right", paddingRight:10, marginLeft:-52 }}>{driver.name}</div>
                                <div style={{ flex:1, height:32, position:"relative", background:"#0f172a", borderRadius:8, overflow:"hidden" }}>
                                  {has && (<>
                                    <div style={{ position:"absolute", left:`${pct}%`, top:"50%", transform:"translate(-50%,-50%)", width:28, height:28, borderRadius:8, background: isConf?"linear-gradient(135deg,#059669,#34d399)":"linear-gradient(135deg,#d97706,#fbbf24)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:900, color:"#fff", boxShadow: isConf?"0 0 10px rgba(52,211,153,0.5)":"0 0 10px rgba(251,191,36,0.5)", zIndex:2 }}>
                                      {schedule.time.split(":")[1]==="00"?`${schedule.time.split(":")[0]}시`:schedule.time}
                                    </div>
                                    <div style={{ position:"absolute", left:0, top:"50%", transform:"translateY(-50%)", width:`${pct}%`, height:3, background: isConf?"linear-gradient(90deg,transparent,#34d39940)":"linear-gradient(90deg,transparent,#fbbf2440)" }} />
                                  </>)}
                                  {!has && <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", paddingLeft:10 }}><div style={{ height:1, flex:1, borderTop:"1px dashed #334155" }} /></div>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div style={{ background:"#1e293b", borderRadius:16, padding:20 }}>
                        <div style={{ fontSize:13, fontWeight:700, color:"#94a3b8", marginBottom:16 }}>📊 시간대별 집중도</div>
                        <div style={{ overflowX:"auto", paddingBottom:4 }}>
                        <div style={{ display:"flex", alignItems:"flex-end", gap:6, height:80, minWidth: `${TIME_SLOTS.filter(t => { const m=toMinutes(t); return m>=rangeStart-60&&m<=rangeEnd+60; }).length * 28}px` }}>
                          {TIME_SLOTS.filter(t => { const m=toMinutes(t); return m>=rangeStart-60&&m<=rangeEnd+60; }).map(t => {
                            const group=byTime[t]||[]; const count=group.length;
                            const maxCount=Math.max(...Object.values(byTime).map(g=>g.length),1);
                            const hPct=count>0?Math.max((count/maxCount)*100,15):0;
                            const hasConf=group.some(g=>g.schedule.status==="confirmed");
                            return (
                              <div key={t} style={{ flex:"0 0 24px", display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                                {count>0&&<div style={{ fontSize:10, fontWeight:800, color: hasConf?"#34d399":"#fbbf24", whiteSpace:"nowrap" }}>{count}명</div>}
                                <div style={{ width:"100%", height:56, display:"flex", alignItems:"flex-end" }}>
                                  <div style={{ width:"100%", height: count>0?`${hPct}%`:"4px", borderRadius:"4px 4px 0 0", background: count===0?"#1a2540":hasConf?"linear-gradient(180deg,#34d399,#059669)":"linear-gradient(180deg,#fbbf24,#d97706)", boxShadow: count>0&&hasConf?"0 -2px 8px rgba(52,211,153,0.4)":count>0?"0 -2px 8px rgba(251,191,36,0.4)":"none" }} />
                                </div>
                                <div style={{ fontSize:9, color:"#475569", fontWeight:600, whiteSpace:"nowrap" }}>
                                  {t.split(":")[1]==="00"?`${t.split(":")[0]}시`:"·"}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        </div>
                        <div style={{ display:"flex", gap:14, marginTop:12 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:11, color:"#64748b" }}><div style={{ width:10, height:10, borderRadius:3, background:"linear-gradient(135deg,#34d399,#059669)" }} />확정</div>
                          <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:11, color:"#64748b" }}><div style={{ width:10, height:10, borderRadius:3, background:"linear-gradient(135deg,#fbbf24,#d97706)" }} />대기중</div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* ── 기사 관리 탭 ── */}
            {managerTab === "drivers" && (
              <div>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
                  <div style={{ fontSize:14, color:"#64748b" }}>총 {drivers.length}명 등록됨</div>
                  <button onClick={() => { setShowAddInput(true); setEditingId(null); setDeleteConfirmId(null); }}
                    style={{ background:"linear-gradient(135deg,#3b82f6,#2563eb)", border:"none", color:"#fff", borderRadius:10, padding:"8px 16px", fontSize:13, fontWeight:700, cursor:"pointer" }}>
                    + 기사 추가
                  </button>
                </div>
                {showAddInput && (
                  <div style={{ background:"#1e3a5f", border:"1px solid #3b82f6", borderRadius:14, padding:16, marginBottom:12, display:"flex", gap:8 }}>
                    <input autoFocus value={newName} onChange={e=>setNewName(e.target.value)}
                      onKeyDown={e=>{ if(e.key==="Enter") addDriver(); if(e.key==="Escape"){setShowAddInput(false);setNewName("");} }}
                      placeholder="이름 입력..."
                      style={{ flex:1, background:"#0f172a", border:"1px solid #334155", borderRadius:8, padding:"10px 12px", color:"#f8fafc", fontSize:14, outline:"none" }} />
                    <button onClick={addDriver} style={{ background:"#3b82f6", border:"none", color:"#fff", borderRadius:8, padding:"10px 14px", fontSize:13, fontWeight:700, cursor:"pointer" }}>추가</button>
                    <button onClick={()=>{setShowAddInput(false);setNewName("");}} style={{ background:"#334155", border:"none", color:"#94a3b8", borderRadius:8, padding:"10px 12px", fontSize:13, cursor:"pointer" }}>✕</button>
                  </div>
                )}
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {drivers.map((driver, idx) => (
                    <div key={driver.id}>
                      <div style={{ background:"#1e293b", borderRadius:14, padding:"12px 16px", display:"flex", alignItems:"center", gap:12 }}>
                        <div style={{ width:36, height:36, borderRadius:10, background:"#0f172a", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:800, color:"#64748b", flexShrink:0 }}>{idx+1}</div>
                        {editingId===driver.id ? (
                          <input autoFocus value={editingName} onChange={e=>setEditingName(e.target.value)}
                            onKeyDown={e=>{ if(e.key==="Enter") saveEdit(); if(e.key==="Escape") setEditingId(null); }}
                            style={{ flex:1, background:"#0f172a", border:"1px solid #3b82f6", borderRadius:8, padding:"8px 10px", color:"#f8fafc", fontSize:14, outline:"none" }} />
                        ) : (
                          <div style={{ flex:1, fontWeight:700, fontSize:15 }}>{driver.name}</div>
                        )}
                        <div style={{ display:"flex", gap:6, flexShrink:0 }}>
                          {editingId===driver.id ? (
                            <>
                              <button onClick={saveEdit} style={{ background:"#065f46", border:"none", color:"#34d399", borderRadius:8, padding:"7px 12px", fontSize:12, fontWeight:700, cursor:"pointer" }}>저장</button>
                              <button onClick={()=>setEditingId(null)} style={{ background:"#334155", border:"none", color:"#94a3b8", borderRadius:8, padding:"7px 10px", fontSize:12, cursor:"pointer" }}>취소</button>
                            </>
                          ) : (
                            <>
                              <button onClick={()=>{ setEditingId(driver.id); setEditingName(driver.name); setDeleteConfirmId(null); }} style={{ background:"#1e3a5f", border:"1px solid #3b82f6", color:"#60a5fa", borderRadius:8, padding:"7px 12px", fontSize:12, fontWeight:600, cursor:"pointer" }}>수정</button>
                              <button onClick={()=>{ setDeleteConfirmId(driver.id); setEditingId(null); }} style={{ background:"#3f1f1f", border:"1px solid #ef4444", color:"#f87171", borderRadius:8, padding:"7px 12px", fontSize:12, fontWeight:600, cursor:"pointer" }}>삭제</button>
                            </>
                          )}
                        </div>
                      </div>
                      {deleteConfirmId===driver.id && (
                        <div style={{ background:"#3f1f1f", border:"1px solid #ef4444", borderRadius:12, padding:"12px 16px", marginTop:6, display:"flex", alignItems:"center", gap:10 }}>
                          <div style={{ flex:1, fontSize:13, color:"#fca5a5" }}>
                            <span style={{ fontWeight:700 }}>{driver.name}</span> 기사를 삭제할까요?<br/>
                            <span style={{ fontSize:11, opacity:0.7 }}>등록된 일정도 함께 삭제됩니다</span>
                          </div>
                          <button onClick={()=>deleteDriver(driver.id)} style={{ background:"#ef4444", border:"none", color:"#fff", borderRadius:8, padding:"8px 14px", fontSize:12, fontWeight:700, cursor:"pointer" }}>삭제</button>
                          <button onClick={()=>setDeleteConfirmId(null)} style={{ background:"#334155", border:"none", color:"#94a3b8", borderRadius:8, padding:"8px 12px", fontSize:12, cursor:"pointer" }}>취소</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {drivers.length===0 && (
                  <div style={{ textAlign:"center", padding:"40px 20px", color:"#475569" }}>
                    <div style={{ fontSize:40, marginBottom:12 }}>👤</div>
                    <div style={{ fontSize:15, fontWeight:600 }}>등록된 기사가 없습니다</div>
                    <div style={{ fontSize:13, marginTop:6 }}>위 버튼으로 기사를 추가하세요</div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn { from{opacity:0;transform:translateY(-8px);}to{opacity:1;transform:translateY(0);} }
        @keyframes spin { to{transform:rotate(360deg)} }
        button:active { transform: scale(0.97); }
        input::placeholder { color: #475569; }
      `}</style>
    </div>
  );
}
