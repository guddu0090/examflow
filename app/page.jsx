"use client";
import { useState, useEffect, useRef, useCallback } from "react";

import { fetchFullDB, genericInsert, mutateEntity, deleteEntity } from "./actions";

let runtimeDB = {
  users: [], classes: [], exams: [], questions: [], attempts: [], classRequests: [], cheatLogs: [], announcements: [], notifications: []
};
const DB_TABLES = ["users", "classes", "exams", "questions", "attempts", "classRequests", "cheatLogs", "announcements", "notifications"];

const getDB = () => runtimeDB;
const uid = () => Math.random().toString(36).slice(2, 10);

const pushNotif = (userId, type, title, body, link="dashboard") => {
  const n = { id:uid(), userId, type, title, body, link, createdAt:new Date().toISOString(), seen:false };
  runtimeDB.notifications.push(n);
};

const examIsOpen = (ex) => {
  if (ex.status !== "active") return false;
  const now = new Date();
  if (ex.opensAt  && new Date(ex.opensAt)  > now) return false;
  if (ex.closesAt && new Date(ex.closesAt) < now) return false;
  return true;
};

const attemptsLeft = (examId, userId) => {
  const ex = runtimeDB.exams.find(e => e.id === examId);
  if (!ex) return 0;
  const max   = ex.maxAttempts || 1;
  const taken = runtimeDB.attempts.filter(a => a.examId === examId && a.userId === userId).length;
  return Math.max(0, max - taken);
};

function syncDiffToBackend(oldDb, newDb) {
  for (const table of DB_TABLES) {
    const oldArr = oldDb[table] || [];
    const newArr = newDb[table] || [];
    
    newArr.forEach(newItem => {
       const oldItem = oldArr.find(o => o.id === newItem.id);
       if (!oldItem) {
          genericInsert(table, newItem).catch(console.error);
       } else if (JSON.stringify(oldItem) !== JSON.stringify(newItem)) {
          mutateEntity(table, newItem.id, newItem).catch(console.error);
       }
    });

    oldArr.forEach(oldItem => {
       const newItem = newArr.find(n => n.id === oldItem.id);
       if (!newItem && table !== "users" && table !== "attempts" && table !== "cheatLogs") {
          deleteEntity(table, oldItem.id).catch(console.error);
       }
    });
  }
}

export default function AppWrapper() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchFullDB().then(db => {
      runtimeDB = db;
      setLoaded(true);
    }).catch(e => {
       console.error(e);
       setLoaded(true); // fall back to empty
    });
  }, []);
  
  useEffect(() => {
    if (!loaded) return;
    let lastSnapshot = JSON.stringify(runtimeDB);
    const interval = setInterval(() => {
       const current = JSON.stringify(runtimeDB);
       if (current !== lastSnapshot) {
          syncDiffToBackend(JSON.parse(lastSnapshot), runtimeDB);
          lastSnapshot = current;
       }
    }, 1000);
    return () => clearInterval(interval);
  }, [loaded]);

  if (!loaded) return <div style={{background:"#0a0f1e", height:"100vh", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff"}}>Loading ExamFlow from Postgres / SQLite...</div>;
  return <App />;
}


// Intercept DB mutations to backend
// We expose a globally accessible wrapper that components will call whenever they mutated the array
// But wait, it's easier to just patch the original App function below.


/* ═══════════════════════════════════════════════════════════
   THEME / TOKENS
═══════════════════════════════════════════════════════════ */
const T = {
  bg:       "#0a0f1e",
  card:     "#111827",
  cardBorder:"rgba(255,255,255,0.07)",
  surface:  "#1a2234",
  text:     "#f1f5f9",
  muted:    "#64748b",
  accent:   "#6366f1",
  accentB:  "#818cf8",
  green:    "#22c55e",
  red:      "#ef4444",
  yellow:   "#f59e0b",
  purple:   "#a855f7",
};

const css = {
  btn: (bg = T.accent, color = "#fff") => ({
    background: bg, color, border: "none", borderRadius: 10, padding: "10px 20px",
    fontWeight: 700, fontSize: 14, cursor: "pointer", transition: "opacity .15s",
    fontFamily: "inherit",
  }),
  card: (extra = {}) => ({
    background: T.card, border: `1px solid ${T.cardBorder}`,
    borderRadius: 16, padding: 24, ...extra,
  }),
  input: {
    background: T.surface, border: `1px solid rgba(255,255,255,0.1)`, borderRadius: 10,
    color: T.text, padding: "10px 14px", fontSize: 14, width: "100%",
    boxSizing: "border-box", fontFamily: "inherit", outline: "none",
  },
  label: { color: T.muted, fontSize: 12, fontWeight: 600, letterSpacing: .5, textTransform: "uppercase", display: "block", marginBottom: 6 },
};

/* ═══════════════════════════════════════════════════════════
   SMALL COMPONENTS
═══════════════════════════════════════════════════════════ */
const Badge = ({ children, color = T.accent }) => (
  <span style={{ background: color + "22", color, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, letterSpacing: .4 }}>{children}</span>
);

const Stat = ({ label, value, sub, color = T.text }) => (
  <div style={{ textAlign: "center" }}>
    <div style={{ fontSize: 32, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{sub}</div>}
    <div style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>{label}</div>
  </div>
);

const Avatar = ({ initials, size = 36, color = T.accent }) => (
  <div style={{ width: size, height: size, borderRadius: "50%", background: color + "33", border: `2px solid ${color}55`, display: "flex", alignItems: "center", justifyContent: "center", color, fontWeight: 800, fontSize: size * .35, flexShrink: 0 }}>{initials}</div>
);

const Modal = ({ onClose, children, title }) => (
  <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(6px)" }} onClick={onClose}>
    <div style={{ ...css.card(), maxWidth: 560, width: "92%", maxHeight: "90vh", overflow: "auto" }} onClick={e => e.stopPropagation()}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h3 style={{ color: T.text, margin: 0, fontSize: 18 }}>{title}</h3>
        <button onClick={onClose} style={{ background: "none", border: "none", color: T.muted, fontSize: 22, cursor: "pointer", lineHeight: 1 }}>×</button>
      </div>
      {children}
    </div>
  </div>
);

/* ═══════════════════════════════════════════════════════════
   AUTH SCREEN  — login + student/teacher register
═══════════════════════════════════════════════════════════ */
function AuthScreen({ onLogin }) {
  const [tab, setTab]   = useState("login");
  const [role, setRole] = useState("student");  // student | teacher
  const [form, setForm] = useState({ name:"", email:"", password:"", subject:"", bio:"" });
  const [err, setErr]   = useState("");
  const [loading, setLoading]   = useState(false);
  const [pendingMsg, setPending] = useState("");

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleLogin = () => {
    setErr(""); setLoading(true);
    setTimeout(() => {
      const u = getDB().users.find(u => u.email === form.email && u.password === form.password);
      if (!u) { setErr("Invalid email or password."); setLoading(false); return; }
      if (u.role === "teacher" && u.teacherStatus === "pending") {
        setErr("⏳ Your teacher account is pending Super Admin approval. You will be notified once approved.");
        setLoading(false); return;
      }
      if (u.role === "teacher" && u.teacherStatus === "rejected") {
        setErr("❌ Your teacher application was rejected. Contact the admin for details.");
        setLoading(false); return;
      }
      onLogin(u);
    }, 600);
  };

  const handleRegister = () => {
    setErr(""); setPending(""); setLoading(true);
    setTimeout(() => {
      if (!form.name || !form.email || !form.password) { setErr("Name, email and password are required."); setLoading(false); return; }
      if (getDB().users.find(u => u.email === form.email)) { setErr("Email already registered."); setLoading(false); return; }
      if (role === "teacher" && !form.subject.trim()) { setErr("Please enter your subject specialisation."); setLoading(false); return; }
      const av = form.name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
      const newUser = {
        id: uid(), name: form.name, email: form.email, password: form.password,
        role, avatar: av, joinedAt: new Date().toISOString().slice(0,10),
        ...(role === "teacher" ? { teacherStatus:"pending", subject: form.subject, bio: form.bio } : { classIds: [] }),
      };
      runtimeDB.users.push(newUser);
      if (role === "teacher") {
        setPending("✅ Application submitted! The Super Admin will review and approve your account. You can sign in once approved.");
        setLoading(false);
      } else {
        onLogin(newUser);
      }
    }, 700);
  };



  return (
    <div style={{ minHeight:"100vh", background:T.bg, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Outfit','Segoe UI',sans-serif", position:"relative", overflow:"hidden" }}>
      <div style={{ position:"absolute", top:"-20%", left:"-10%", width:600, height:600, borderRadius:"50%", background:"radial-gradient(circle, rgba(99,102,241,.15) 0%, transparent 70%)", pointerEvents:"none" }} />
      <div style={{ position:"absolute", bottom:"-20%", right:"-10%", width:500, height:500, borderRadius:"50%", background:"radial-gradient(circle, rgba(168,85,247,.12) 0%, transparent 70%)", pointerEvents:"none" }} />

      <div style={{ ...css.card(), width:440, boxShadow:"0 40px 100px rgba(0,0,0,.5)", position:"relative" }}>
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div style={{ width:56, height:56, borderRadius:16, background:"linear-gradient(135deg,#6366f1,#a855f7)", margin:"0 auto 14px", display:"flex", alignItems:"center", justifyContent:"center", fontSize:26 }}>🎓</div>
          <h1 style={{ color:T.text, fontSize:24, margin:0, fontWeight:800, letterSpacing:"-0.5px" }}>ExamFlow</h1>
          <p style={{ color:T.muted, fontSize:13, margin:"4px 0 0" }}>Intelligent Multi-Role Exam Platform</p>
        </div>

        {/* Tab switch */}
        <div style={{ display:"flex", background:T.surface, borderRadius:10, padding:4, marginBottom:22, gap:4 }}>
          {["login","register"].map(t => (
            <button key={t} onClick={() => { setTab(t); setErr(""); setPending(""); }} style={{ flex:1, padding:"9px 0", borderRadius:8, background:tab===t?T.accent:"transparent", border:"none", color:tab===t?"#fff":T.muted, fontWeight:700, fontSize:13, cursor:"pointer", transition:"all .2s", fontFamily:"inherit" }}>
              {t === "login" ? "Sign In" : "Register"}
            </button>
          ))}
        </div>

        {tab === "login" ? (
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div><label style={css.label}>Email</label><input style={css.input} placeholder="your@email.com" value={form.email} onChange={e=>f("email",e.target.value)} /></div>
            <div><label style={css.label}>Password</label><input style={css.input} type="password" placeholder="••••••••" value={form.password} onChange={e=>f("password",e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleLogin()} /></div>
            {err && <div style={{ color:T.red, fontSize:13, background:T.red+"15", padding:"10px 12px", borderRadius:8, lineHeight:1.5 }}>{err}</div>}
            <button style={{ ...css.btn("linear-gradient(135deg,#6366f1,#a855f7)"), padding:"13px 0", fontSize:15, opacity:loading?.7:1 }} onClick={handleLogin} disabled={loading}>
              {loading ? "Signing in…" : "Sign In →"}
            </button>
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            {/* Role selector */}
            <div>
              <label style={css.label}>I am a…</label>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                {[["student","👨‍🎓","Student","Take exams"],["teacher","👩‍🏫","Teacher","Create classes & exams"]].map(([r,icon,lab,sub]) => (
                  <button key={r} onClick={() => setRole(r)}
                    style={{ padding:"12px 8px", borderRadius:10, border:`2px solid ${role===r?T.accent:T.cardBorder}`, background:role===r?T.accent+"15":T.surface, cursor:"pointer", textAlign:"center", fontFamily:"inherit", transition:"all .15s" }}>
                    <div style={{ fontSize:22 }}>{icon}</div>
                    <div style={{ color:role===r?T.accentB:T.text, fontWeight:700, fontSize:13, marginTop:4 }}>{lab}</div>
                    <div style={{ color:T.muted, fontSize:11 }}>{sub}</div>
                  </button>
                ))}
              </div>
            </div>

            <div><label style={css.label}>Full Name</label><input style={css.input} placeholder="Your full name" value={form.name} onChange={e=>f("name",e.target.value)} /></div>
            <div><label style={css.label}>Email</label><input style={css.input} placeholder="you@email.com" value={form.email} onChange={e=>f("email",e.target.value)} /></div>
            <div><label style={css.label}>Password</label><input style={css.input} type="password" placeholder="Min 6 characters" value={form.password} onChange={e=>f("password",e.target.value)} /></div>

            {role === "teacher" && <>
              <div><label style={css.label}>Subject Specialisation *</label><input style={css.input} placeholder="e.g. Mathematics, Physics" value={form.subject} onChange={e=>f("subject",e.target.value)} /></div>
              <div><label style={css.label}>Short Bio</label><textarea style={{ ...css.input, height:60, resize:"vertical" }} placeholder="Brief description of your teaching experience…" value={form.bio} onChange={e=>f("bio",e.target.value)} /></div>
              <div style={{ background:T.yellow+"15", border:`1px solid ${T.yellow}33`, borderRadius:10, padding:"10px 14px", fontSize:12, color:T.yellow, lineHeight:1.5 }}>
                ⏳ Teacher accounts require Super Admin approval before you can sign in. You'll be notified once reviewed.
              </div>
            </>}

            {err && <div style={{ color:T.red, fontSize:13, background:T.red+"15", padding:"10px 12px", borderRadius:8 }}>{err}</div>}
            {pendingMsg && <div style={{ color:T.green, fontSize:13, background:T.green+"15", padding:"10px 12px", borderRadius:8, lineHeight:1.5 }}>{pendingMsg}</div>}

            {!pendingMsg && (
              <button style={{ ...css.btn("linear-gradient(135deg,#6366f1,#a855f7)"), padding:"13px 0", fontSize:15, opacity:loading?.7:1 }} onClick={handleRegister} disabled={loading}>
                {loading ? "Creating…" : role==="teacher" ? "Apply as Teacher →" : "Create Account →"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SIDEBAR NAV
═══════════════════════════════════════════════════════════ */
function Sidebar({ user, page, setPage, onLogout }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showNotifs, setShowNotifs]  = useState(false);
  const db = getDB();

  const superAdminNav = [
    { id:"dashboard",  icon:"🏠", label:"Dashboard"     },
    { id:"teachers",   icon:"👩‍🏫", label:"Teachers"      },
    { id:"students",   icon:"👥", label:"Students"      },
    { id:"classes",    icon:"🏫", label:"All Classes"   },
    { id:"results",    icon:"📊", label:"All Results"   },
    { id:"cheatlogs",  icon:"🚨", label:"Cheat Alerts"  },
    { id:"analytics",  icon:"📈", label:"Analytics"     },
  ];
  const teacherNav = [
    { id:"dashboard",  icon:"🏠", label:"Dashboard"     },
    { id:"classes",    icon:"🏫", label:"My Classes"    },
    { id:"exams",      icon:"📋", label:"Exams"         },
    { id:"questions",  icon:"❓", label:"Question Bank" },
    { id:"students",   icon:"👥", label:"My Students"   },
    { id:"results",    icon:"📊", label:"Results"       },
    { id:"cheatlogs",  icon:"🚨", label:"Cheat Alerts"  },
    { id:"analytics",  icon:"📈", label:"Analytics"     },
    { id:"announce",   icon:"📢", label:"Announcements" },
  ];
  const studentNav = [
    { id:"dashboard",  icon:"🏠", label:"Home"          },
    { id:"joinclass",  icon:"🏫", label:"Join Class"    },
    { id:"exams",      icon:"📋", label:"My Exams"      },
    { id:"results",    icon:"📊", label:"My Results"    },
    { id:"leaderboard",icon:"🏆", label:"Leaderboard"   },
  ];

  const nav         = user.role==="superadmin" ? superAdminNav : user.role==="teacher" ? teacherNav : studentNav;
  const portalLabel = user.role==="superadmin" ? "Super Admin" : user.role==="teacher" ? "Teacher Portal" : "Student Portal";
  const roleColor   = user.role==="superadmin" ? T.purple : user.role==="teacher" ? T.yellow : T.green;
  const myNotifs    = db.notifications.filter(n => n.userId === user.id);
  const unseenNotifs= myNotifs.filter(n => !n.seen).length;
  const myExamIds   = user.role==="teacher" ? db.exams.filter(e=>e.createdBy===user.id).map(e=>e.id) : null;

  const getBadge = (id) => {
    if (id==="cheatlogs") return db.cheatLogs.filter(l=>!l.seen&&(myExamIds===null||myExamIds.includes(l.examId))).length;
    if (id==="classes" && user.role==="teacher") return db.classRequests.filter(r=>db.classes.filter(c=>c.teacherId===user.id).some(c=>c.id===r.classId)&&r.status==="pending").length;
    return 0;
  };

  const markNotifsSeen = () => {
    runtimeDB.notifications.forEach(n => { if (n.userId===user.id) n.seen=true; });
    setShowNotifs(false);
  };

  const navContent = (
    <>
      <div style={{ padding:"22px 18px 14px", borderBottom:`1px solid ${T.cardBorder}`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:34, height:34, borderRadius:9, background:"linear-gradient(135deg,#6366f1,#a855f7)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:17 }}>🎓</div>
          <div>
            <div style={{ color:T.text, fontWeight:800, fontSize:15, lineHeight:1 }}>ExamFlow</div>
            <div style={{ color:T.muted, fontSize:10, marginTop:2 }}>{portalLabel}</div>
          </div>
        </div>
        {/* Notification bell */}
        <div style={{ position:"relative" }}>
          <button onClick={() => setShowNotifs(s=>!s)} style={{ ...css.btn(T.surface,T.muted), padding:"6px 8px", fontSize:16, position:"relative" }}>
            🔔
            {unseenNotifs > 0 && <span style={{ position:"absolute", top:-4, right:-4, background:T.red, color:"#fff", fontSize:9, fontWeight:800, borderRadius:"50%", width:16, height:16, display:"flex", alignItems:"center", justifyContent:"center" }}>{unseenNotifs}</span>}
          </button>
          {showNotifs && (
            <div style={{ position:"absolute", top:"calc(100% + 8px)", right:0, width:290, background:T.card, border:`1px solid ${T.cardBorder}`, borderRadius:14, boxShadow:"0 8px 32px rgba(0,0,0,.4)", zIndex:9999, overflow:"hidden" }}>
              <div style={{ padding:"12px 16px", borderBottom:`1px solid ${T.cardBorder}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span style={{ color:T.text, fontWeight:700, fontSize:14 }}>Notifications</span>
                {unseenNotifs > 0 && <button style={{ ...css.btn(T.surface,T.muted), fontSize:11, padding:"3px 8px" }} onClick={markNotifsSeen}>Mark all read</button>}
              </div>
              <div style={{ maxHeight:320, overflowY:"auto" }}>
                {myNotifs.length === 0 && <div style={{ padding:24, color:T.muted, fontSize:13, textAlign:"center" }}>No notifications yet</div>}
                {[...myNotifs].reverse().map(n => {
                  const icons = { result:"📊", announce:"📢", cheat:"🚨", request:"⏳", approve:"✅", reject:"❌" };
                  return (
                    <div key={n.id} onClick={() => { runtimeDB.notifications.find(x=>x.id===n.id).seen=true; setPage(n.link||"dashboard"); setShowNotifs(false); }}
                      style={{ padding:"12px 16px", borderBottom:`1px solid ${T.cardBorder}`, cursor:"pointer", background:n.seen?"transparent":T.accent+"0d", display:"flex", gap:10, alignItems:"flex-start" }}>
                      <span style={{ fontSize:16, flexShrink:0 }}>{icons[n.type]||"🔔"}</span>
                      <div style={{ flex:1 }}>
                        <div style={{ color:T.text, fontSize:13, fontWeight:n.seen?500:700, marginBottom:2 }}>{n.title}</div>
                        <div style={{ color:T.muted, fontSize:11 }}>{n.body}</div>
                        <div style={{ color:T.muted, fontSize:10, marginTop:3 }}>{new Date(n.createdAt).toLocaleString()}</div>
                      </div>
                      {!n.seen && <div style={{ width:8, height:8, borderRadius:"50%", background:T.accent, flexShrink:0, marginTop:3 }} />}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
      <nav style={{ flex:1, padding:"12px 10px", overflowY:"auto" }}>
        {nav.map(item => {
          const badge = getBadge(item.id);
          return (
            <button key={item.id} onClick={() => { setPage(item.id); setMobileOpen(false); }}
              style={{ width:"100%", display:"flex", alignItems:"center", gap:12, padding:"10px 12px", borderRadius:10, background:page===item.id?T.accent+"22":"transparent", border:`1px solid ${page===item.id?T.accent+"44":"transparent"}`, color:page===item.id?T.accentB:T.muted, fontWeight:page===item.id?700:500, fontSize:13, cursor:"pointer", transition:"all .15s", marginBottom:3, textAlign:"left", fontFamily:"inherit" }}>
              <span style={{ fontSize:15 }}>{item.icon}</span>
              <span style={{ flex:1 }}>{item.label}</span>
              {badge > 0 && <span style={{ background:item.id==="cheatlogs"?T.red:T.yellow, color:item.id==="cheatlogs"?"#fff":"#000", fontSize:10, fontWeight:800, borderRadius:20, minWidth:18, height:18, display:"flex", alignItems:"center", justifyContent:"center", padding:"0 5px" }}>{badge}</span>}
            </button>
          );
        })}
      </nav>
      <div style={{ padding:"12px 14px", borderTop:`1px solid ${T.cardBorder}` }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
          <Avatar initials={user.avatar} size={32} color={roleColor} />
          <div style={{ overflow:"hidden", flex:1 }}>
            <div style={{ color:T.text, fontWeight:600, fontSize:12, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{user.name}</div>
            <Badge color={roleColor}>{user.role}</Badge>
          </div>
        </div>
        <button onClick={onLogout} style={{ ...css.btn(T.surface,T.muted), width:"100%", fontSize:12, padding:"7px 0" }}>Sign Out</button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile hamburger bar */}
      <div style={{ display:"none" }} className="mobile-bar">
        <div style={{ position:"fixed", top:0, left:0, right:0, height:52, background:T.card, borderBottom:`1px solid ${T.cardBorder}`, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 16px", zIndex:1000 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <div style={{ width:28, height:28, borderRadius:7, background:"linear-gradient(135deg,#6366f1,#a855f7)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 }}>🎓</div>
            <span style={{ color:T.text, fontWeight:800, fontSize:15 }}>ExamFlow</span>
          </div>
          <button onClick={() => setMobileOpen(s=>!s)} style={{ ...css.btn(T.surface,T.muted), padding:"6px 10px", fontSize:18 }}>{mobileOpen ? "✕" : "☰"}</button>
        </div>
        {mobileOpen && (
          <div style={{ position:"fixed", inset:0, zIndex:999, display:"flex" }}>
            <div style={{ width:240, background:T.card, borderRight:`1px solid ${T.cardBorder}`, display:"flex", flexDirection:"column", paddingTop:52, height:"100%", overflowY:"auto" }}>{navContent}</div>
            <div style={{ flex:1, background:"rgba(0,0,0,.6)" }} onClick={() => setMobileOpen(false)} />
          </div>
        )}
      </div>
      {/* Desktop sidebar */}
      <div style={{ width:228, background:T.card, borderRight:`1px solid ${T.cardBorder}`, display:"flex", flexDirection:"column", flexShrink:0, minHeight:"100vh", position:"relative" }} className="desktop-sidebar">
        {navContent}
      </div>
      <style>{`
        @media (max-width: 768px) {
          .desktop-sidebar { display: none !important; }
          .mobile-bar { display: block !important; }
          .main-content { padding: 64px 12px 20px !important; }
          .stats-grid { grid-template-columns: 1fr 1fr !important; }
          .exam-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════
   SUPER ADMIN: TEACHER MANAGEMENT
═══════════════════════════════════════════════════════════ */
function TeacherManager() {
  const [teachers, setTeachers] = useState(getDB().users.filter(u => u.role === "teacher"));
  const [view, setView] = useState(null); // teacher object for detail modal

  const refresh = () => setTeachers(getDB().users.filter(u => u.role === "teacher"));

  const approve = (id) => {
    const i = runtimeDB.users.findIndex(u => u.id === id);
    runtimeDB.users[i].teacherStatus = "approved";
    refresh();
  };
  const reject = (id) => {
    const i = runtimeDB.users.findIndex(u => u.id === id);
    runtimeDB.users[i].teacherStatus = "rejected";
    refresh();
  };
  const revoke = (id) => {
    const i = runtimeDB.users.findIndex(u => u.id === id);
    runtimeDB.users[i].teacherStatus = "pending";
    refresh();
  };

  const pending  = teachers.filter(t => t.teacherStatus === "pending");
  const approved = teachers.filter(t => t.teacherStatus === "approved");
  const rejected = teachers.filter(t => t.teacherStatus === "rejected");

  const statusColor = { pending:T.yellow, approved:T.green, rejected:T.red };

  const TeacherRow = ({ t }) => {
    const classes = getDB().classes.filter(c => c.teacherId === t.id);
    const exams   = getDB().exams.filter(e => e.createdBy === t.id);
    return (
      <div style={{ ...css.card({padding:"16px 20px"}), display:"flex", alignItems:"center", gap:16, marginBottom:10 }}>
        <Avatar initials={t.avatar} size={44} color={statusColor[t.teacherStatus]} />
        <div style={{ flex:1 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
            <span style={{ color:T.text, fontWeight:700, fontSize:15 }}>{t.name}</span>
            <Badge color={statusColor[t.teacherStatus]}>{t.teacherStatus}</Badge>
          </div>
          <div style={{ color:T.muted, fontSize:13 }}>{t.email} · {t.subject}</div>
          {t.bio && <div style={{ color:T.muted, fontSize:12, marginTop:2, fontStyle:"italic" }}>"{t.bio}"</div>}
          <div style={{ display:"flex", gap:12, marginTop:6, fontSize:12, color:T.muted }}>
            <span>🏫 {classes.length} class{classes.length!==1?"es":""}</span>
            <span>📋 {exams.length} exam{exams.length!==1?"s":""}</span>
            <span>📅 Joined {t.joinedAt}</span>
          </div>
        </div>
        <div style={{ display:"flex", gap:8, flexShrink:0 }}>
          {t.teacherStatus === "pending" && <>
            <button style={css.btn(T.green)} onClick={() => approve(t.id)}>✓ Approve</button>
            <button style={css.btn(T.red+"22", T.red)} onClick={() => reject(t.id)}>✗ Reject</button>
          </>}
          {t.teacherStatus === "approved" && <>
            <button style={css.btn(T.surface, T.muted)} onClick={() => setView(t)}>View</button>
            <button style={css.btn(T.red+"22", T.red)} onClick={() => revoke(t.id)}>Revoke</button>
          </>}
          {t.teacherStatus === "rejected" && <>
            <button style={css.btn(T.green+"22", T.green)} onClick={() => approve(t.id)}>Re-approve</button>
          </>}
        </div>
      </div>
    );
  };

  return (
    <div>
      <h2 style={{ color:T.text, fontSize:22, fontWeight:800, margin:"0 0 8px" }}>Teacher Management</h2>
      <p style={{ color:T.muted, fontSize:13, margin:"0 0 24px" }}>Review teacher applications and manage access permissions.</p>

      {/* Pending — highlight at top */}
      {pending.length > 0 && (
        <div style={{ marginBottom:28 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
            <div style={{ width:8, height:8, borderRadius:"50%", background:T.yellow, animation:"pulse 1.5s infinite" }} />
            <h3 style={{ color:T.yellow, margin:0, fontSize:15, fontWeight:700 }}>Pending Approval ({pending.length})</h3>
          </div>
          {pending.map(t => <TeacherRow key={t.id} t={t} />)}
        </div>
      )}

      {approved.length > 0 && (
        <div style={{ marginBottom:28 }}>
          <h3 style={{ color:T.green, margin:"0 0 14px", fontSize:15, fontWeight:700 }}>✓ Approved Teachers ({approved.length})</h3>
          {approved.map(t => <TeacherRow key={t.id} t={t} />)}
        </div>
      )}

      {rejected.length > 0 && (
        <div>
          <h3 style={{ color:T.red, margin:"0 0 14px", fontSize:15, fontWeight:700 }}>✗ Rejected ({rejected.length})</h3>
          {rejected.map(t => <TeacherRow key={t.id} t={t} />)}
        </div>
      )}

      {teachers.length === 0 && (
        <div style={{ ...css.card({textAlign:"center",padding:56}) }}>
          <div style={{ fontSize:48, marginBottom:12 }}>👩‍🏫</div>
          <div style={{ color:T.muted }}>No teacher applications yet.</div>
        </div>
      )}

      {/* Teacher detail modal */}
      {view && (
        <Modal title={`${view.name} — Teacher Profile`} onClose={() => setView(null)}>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div style={{ display:"flex", alignItems:"center", gap:16 }}>
              <Avatar initials={view.avatar} size={56} color={T.green} />
              <div>
                <div style={{ color:T.text, fontWeight:700, fontSize:18 }}>{view.name}</div>
                <div style={{ color:T.muted, fontSize:13 }}>{view.email}</div>
                <Badge color={T.green}>{view.teacherStatus}</Badge>
              </div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <div style={{ ...css.card({padding:14}) }}><div style={{ color:T.muted, fontSize:11 }}>SUBJECT</div><div style={{ color:T.text, fontWeight:700 }}>{view.subject}</div></div>
              <div style={{ ...css.card({padding:14}) }}><div style={{ color:T.muted, fontSize:11 }}>JOINED</div><div style={{ color:T.text, fontWeight:700 }}>{view.joinedAt}</div></div>
              <div style={{ ...css.card({padding:14}) }}><div style={{ color:T.muted, fontSize:11 }}>CLASSES</div><div style={{ color:T.text, fontWeight:700 }}>{getDB().classes.filter(c=>c.teacherId===view.id).length}</div></div>
              <div style={{ ...css.card({padding:14}) }}><div style={{ color:T.muted, fontSize:11 }}>EXAMS</div><div style={{ color:T.text, fontWeight:700 }}>{getDB().exams.filter(e=>e.createdBy===view.id).length}</div></div>
            </div>
            {view.bio && <div style={{ color:T.muted, fontSize:13, fontStyle:"italic", padding:"10px 14px", background:T.surface, borderRadius:10 }}>"{view.bio}"</div>}
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SUPER ADMIN: ALL CLASSES VIEW
═══════════════════════════════════════════════════════════ */
function AllClassesView() {
  const db = getDB();
  return (
    <div>
      <h2 style={{ color:T.text, fontSize:22, fontWeight:800, margin:"0 0 24px" }}>All Classes</h2>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))", gap:16 }}>
        {db.classes.map(cls => {
          const teacher  = db.users.find(u => u.id === cls.teacherId);
          const students = db.users.filter(u => (u.classIds||[]).includes(cls.id));
          const exams    = db.exams.filter(e => e.classId === cls.id);
          return (
            <div key={cls.id} style={css.card()}>
              <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14 }}>
                <div style={{ width:44, height:44, borderRadius:12, background:T.accent+"22", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>🏫</div>
                <div>
                  <div style={{ color:T.text, fontWeight:700, fontSize:15 }}>{cls.name}</div>
                  <div style={{ color:T.muted, fontSize:12 }}>{cls.description}</div>
                </div>
              </div>
              <div style={{ borderTop:`1px solid ${T.cardBorder}`, paddingTop:12, display:"flex", gap:8, flexWrap:"wrap" }}>
                {teacher && <Badge color={T.yellow}>👩‍🏫 {teacher.name}</Badge>}
                <Badge color={T.accent}>👥 {students.length} students</Badge>
                <Badge color={T.green}>📋 {exams.length} exams</Badge>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   TEACHER: CLASS MANAGER
═══════════════════════════════════════════════════════════ */
function TeacherClassManager({ user }) {
  const [classes, setClasses] = useState(getDB().classes.filter(c => c.teacherId === user.id));
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name:"", description:"" });
  const [enrollModal, setEnrollModal] = useState(null); // class object
  const [inviteCode, setInviteCode] = useState("");

  const f = (k,v) => setForm(p => ({...p,[k]:v}));
  const refresh = () => setClasses(getDB().classes.filter(c => c.teacherId === user.id));

  const createClass = () => {
    if (!form.name.trim()) return;
    const newClass = { id: uid(), name: form.name.trim(), description: form.description.trim(), teacherId: user.id, createdAt: new Date().toISOString().slice(0,10) };
    runtimeDB.classes.push(newClass);
    refresh(); setShowModal(false); setForm({ name:"", description:"" });
  };

  const delClass = (id) => {
    runtimeDB.classes = runtimeDB.classes.filter(c => c.id !== id);
    refresh();
  };

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
        <h2 style={{ color:T.text, fontSize:22, fontWeight:800, margin:0 }}>My Classes</h2>
        <button style={css.btn("linear-gradient(135deg,#6366f1,#a855f7)")} onClick={() => setShowModal(true)}>+ Create Class</button>
      </div>

      {classes.length === 0 && (
        <div style={{ ...css.card({textAlign:"center",padding:56}) }}>
          <div style={{ fontSize:48, marginBottom:12 }}>🏫</div>
          <div style={{ color:T.muted, marginBottom:20 }}>No classes yet. Create your first class!</div>
          <button style={css.btn("linear-gradient(135deg,#6366f1,#a855f7)")} onClick={() => setShowModal(true)}>+ Create Class</button>
        </div>
      )}

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))", gap:16 }}>
        {classes.map(cls => {
          const students = getDB().users.filter(u => (u.classIds||[]).includes(cls.id));
          const exams    = getDB().exams.filter(e => e.classId === cls.id);
          return (
            <div key={cls.id} style={css.card()}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14 }}>
                <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                  <div style={{ width:44, height:44, borderRadius:12, background:T.accent+"22", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>🏫</div>
                  <div>
                    <div style={{ color:T.text, fontWeight:700, fontSize:15 }}>{cls.name}</div>
                    <div style={{ color:T.muted, fontSize:12 }}>{cls.description || "No description"}</div>
                  </div>
                </div>
                <button style={css.btn(T.red+"22",T.red)} onClick={() => delClass(cls.id)}>Del</button>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, padding:"12px 0", borderTop:`1px solid ${T.cardBorder}`, borderBottom:`1px solid ${T.cardBorder}`, marginBottom:14, textAlign:"center" }}>
                <div><div style={{ color:T.text, fontWeight:700 }}>{students.length}</div><div style={{ color:T.muted, fontSize:11 }}>Students</div></div>
                <div><div style={{ color:T.text, fontWeight:700 }}>{exams.length}</div><div style={{ color:T.muted, fontSize:11 }}>Exams</div></div>
                <div><div style={{ color:T.text, fontWeight:700 }}>{cls.createdAt}</div><div style={{ color:T.muted, fontSize:11 }}>Created</div></div>
              </div>
              {/* Class join code + pending badge */}
              {(() => {
                const pendingCount = getDB().classRequests.filter(r => r.classId === cls.id && r.status === "pending").length;
                return (
                  <div style={{ background:T.surface, borderRadius:10, padding:"10px 14px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div>
                      <div style={{ color:T.muted, fontSize:11, marginBottom:2 }}>CLASS JOIN CODE</div>
                      <div style={{ color:T.accentB, fontWeight:800, fontSize:16, letterSpacing:2 }}>{cls.id.slice(0,6).toUpperCase()}</div>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      {pendingCount > 0 && (
                        <div style={{ background:T.yellow, color:"#000", fontWeight:800, fontSize:11, borderRadius:"50%", width:22, height:22, display:"flex", alignItems:"center", justifyContent:"center" }}>{pendingCount}</div>
                      )}
                      <button style={css.btn(pendingCount > 0 ? T.yellow : T.accent, pendingCount > 0 ? "#000" : "#fff")} onClick={() => { setEnrollModal(cls); setInviteCode(""); }}>
                        {pendingCount > 0 ? `⏳ ${pendingCount} Request${pendingCount>1?"s":""}` : "Manage Students"}
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>

      {/* Create class modal */}
      {showModal && (
        <Modal title="Create New Class" onClose={() => setShowModal(false)}>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div><label style={css.label}>Class Name *</label><input style={css.input} value={form.name} onChange={e=>f("name",e.target.value)} placeholder="e.g. Maths Batch A 2027" /></div>
            <div><label style={css.label}>Description</label><textarea style={{ ...css.input, height:72, resize:"vertical" }} value={form.description} onChange={e=>f("description",e.target.value)} placeholder="Brief class description…" /></div>
            <button style={{ ...css.btn("linear-gradient(135deg,#6366f1,#a855f7)"), padding:"12px 0", fontSize:15 }} onClick={createClass}>Create Class</button>
          </div>
        </Modal>
      )}

      {/* Enrol student modal */}
      {enrollModal && (
        <Modal title={`Manage — ${enrollModal.name}`} onClose={() => { setEnrollModal(null); setInviteCode(""); }}>
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

            {/* Code */}
            <div style={{ background:T.surface, borderRadius:12, padding:"14px 18px", textAlign:"center" }}>
              <div style={{ color:T.muted, fontSize:12, marginBottom:6 }}>Share this code with students:</div>
              <div style={{ color:T.accentB, fontWeight:900, fontSize:32, letterSpacing:6 }}>{enrollModal.id.slice(0,6).toUpperCase()}</div>
              <div style={{ color:T.muted, fontSize:11, marginTop:4 }}>Students enter this code in "Join Class" to send a request</div>
            </div>

            {/* Pending join requests */}
            {(() => {
              const reqs = getDB().classRequests.filter(r => r.classId === enrollModal.id && r.status === "pending");
              return (
                <div>
                  <div style={{ color:T.yellow, fontSize:12, fontWeight:700, textTransform:"uppercase", letterSpacing:.5, marginBottom:10 }}>
                    ⏳ Join Requests {reqs.length > 0 ? `(${reqs.length})` : ""}
                  </div>
                  {reqs.length === 0 && (
                    <div style={{ color:T.muted, fontSize:13, padding:"10px 0" }}>No pending requests.</div>
                  )}
                  {reqs.map(req => {
                    const student = getDB().users.find(u => u.id === req.studentId);
                    return (
                      <div key={req.id} style={{ background:T.yellow+"0d", border:`1px solid ${T.yellow}33`, borderRadius:10, padding:"12px 14px", marginBottom:8, display:"flex", alignItems:"center", gap:12 }}>
                        <Avatar initials={student?.avatar||"?"} size={36} color={T.yellow} />
                        <div style={{ flex:1 }}>
                          <div style={{ color:T.text, fontWeight:700 }}>{student?.name}</div>
                          <div style={{ color:T.muted, fontSize:12 }}>{student?.email} · {new Date(req.requestedAt).toLocaleDateString()}</div>
                          {req.note && <div style={{ color:T.muted, fontSize:12, fontStyle:"italic", marginTop:2 }}>"{req.note}"</div>}
                        </div>
                        <div style={{ display:"flex", gap:8, flexShrink:0 }}>
                          <button style={{ ...css.btn(T.green), padding:"7px 14px", fontSize:13 }} onClick={() => {
                            const rIdx = runtimeDB.classRequests.findIndex(r => r.id === req.id);
                            runtimeDB.classRequests[rIdx].status = "approved";
                            const uIdx = runtimeDB.users.findIndex(u => u.id === req.studentId);
                            if (!(runtimeDB.users[uIdx].classIds||[]).includes(enrollModal.id))
                              runtimeDB.users[uIdx].classIds = [...(runtimeDB.users[uIdx].classIds||[]), enrollModal.id];
                            pushNotif(req.studentId, "approve", "Join request approved!", `You've been added to ${enrollModal.name}`, "dashboard");
                            setEnrollModal({...enrollModal});
                          }}>✓ Approve</button>
                          <button style={{ ...css.btn(T.red+"22", T.red), padding:"7px 14px", fontSize:13 }} onClick={() => {
                            const rIdx = runtimeDB.classRequests.findIndex(r => r.id === req.id);
                            runtimeDB.classRequests[rIdx].status = "rejected";
                            pushNotif(req.studentId, "reject", "Join request declined", `Your request to join ${enrollModal.name} was not approved`, "joinclass");
                            setEnrollModal({...enrollModal});
                          }}>✗ Reject</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* Manual add */}
            <div>
              <label style={css.label}>Manually Add by Email</label>
              <div style={{ display:"flex", gap:8 }}>
                <input style={{ ...css.input, flex:1 }} value={inviteCode} onChange={e=>setInviteCode(e.target.value)} placeholder="student@email.com" />
                <button style={{ ...css.btn(T.accent), flexShrink:0 }} onClick={() => {
                  const student = runtimeDB.users.find(u => u.email.toLowerCase() === inviteCode.toLowerCase() && u.role === "student");
                  if (!student) { alert("Student not found."); return; }
                  const idx = runtimeDB.users.findIndex(u => u.id === student.id);
                  if (!(runtimeDB.users[idx].classIds||[]).includes(enrollModal.id))
                    runtimeDB.users[idx].classIds = [...(runtimeDB.users[idx].classIds||[]), enrollModal.id];
                  setInviteCode(""); setEnrollModal({...enrollModal});
                }}>Add</button>
              </div>
            </div>

            {/* Enrolled students */}
            <div>
              <div style={{ color:T.muted, fontSize:12, fontWeight:700, textTransform:"uppercase", letterSpacing:.5, marginBottom:10 }}>
                Enrolled ({getDB().users.filter(u=>(u.classIds||[]).includes(enrollModal.id)).length})
              </div>
              {getDB().users.filter(u => (u.classIds||[]).includes(enrollModal.id)).map(s => (
                <div key={s.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0", borderBottom:`1px solid ${T.cardBorder}` }}>
                  <Avatar initials={s.avatar} size={30} color={T.green} />
                  <span style={{ color:T.text, fontSize:13, flex:1 }}>{s.name}</span>
                  <span style={{ color:T.muted, fontSize:12 }}>{s.email}</span>
                  <button style={{ ...css.btn(T.red+"22",T.red), padding:"4px 10px", fontSize:11 }} onClick={() => {
                    const idx = runtimeDB.users.findIndex(u => u.id === s.id);
                    runtimeDB.users[idx].classIds = (runtimeDB.users[idx].classIds||[]).filter(id=>id!==enrollModal.id);
                    setEnrollModal({...enrollModal});
                  }}>Remove</button>
                </div>
              ))}
              {getDB().users.filter(u => (u.classIds||[]).includes(enrollModal.id)).length === 0 && (
                <div style={{ color:T.muted, fontSize:13, textAlign:"center", padding:16 }}>No students enrolled yet.</div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SUPER ADMIN DASHBOARD
═══════════════════════════════════════════════════════════ */
function AdminDashboard({ user }) {
  const db = getDB();
  const totalStudents = db.users.filter(u => u.role === "student").length;
  const totalTeachers = db.users.filter(u => u.role === "teacher" && u.teacherStatus === "approved").length;
  const pendingTeachers = db.users.filter(u => u.role === "teacher" && u.teacherStatus === "pending").length;
  const totalExams = db.exams.length;
  const totalAttempts = db.attempts.length;
  const avgScore = db.attempts.length ? (db.attempts.reduce((s,a) => s + (a.score/a.total)*100, 0) / db.attempts.length).toFixed(1) : 0;

  const recentAttempts = [...db.attempts].sort((a,b) => new Date(b.submittedAt) - new Date(a.submittedAt)).slice(0,5);

  return (
    <div>
      <h2 style={{ color: T.text, fontSize: 22, fontWeight: 800, margin: "0 0 16px" }}>Dashboard Overview</h2>
      {pendingTeachers > 0 && (
        <div style={{ background:T.yellow+"15", border:`1px solid ${T.yellow}44`, borderRadius:12, padding:"12px 20px", marginBottom:20, display:"flex", alignItems:"center", gap:12 }}>
          <span style={{ fontSize:20 }}>⏳</span>
          <div style={{ flex:1 }}><span style={{ color:T.yellow, fontWeight:700 }}>{pendingTeachers} teacher application{pendingTeachers>1?"s":""} awaiting your approval.</span><span style={{ color:T.muted, fontSize:13 }}> Go to Teachers tab to review.</span></div>
        </div>
      )}

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 28 }}>
        {[
          { label: "Students",        value: totalStudents, icon: "👥", color: T.accent },
          { label: "Active Teachers", value: totalTeachers, icon: "👩‍🏫", color: T.yellow },
          { label: "Active Exams",   value: db.exams.filter(e=>e.status==="active").length, icon: "📋", color: T.green },
          { label: "Avg Score",      value: avgScore + "%", icon: "📊", color: T.purple },
        ].map(s => (
          <div key={s.label} style={{ ...css.card(), display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: s.color + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{s.icon}</div>
            <div>
              <div style={{ color: T.text, fontSize: 26, fontWeight: 800 }}>{s.value}</div>
              <div style={{ color: T.muted, fontSize: 12 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent attempts */}
      <div style={css.card()}>
        <h3 style={{ color: T.text, margin: "0 0 20px", fontSize: 16, fontWeight: 700 }}>Recent Attempts</h3>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>{["Student","Exam","Score","Time","Status"].map(h => (
              <th key={h} style={{ color: T.muted, fontSize: 11, fontWeight: 700, textAlign: "left", padding: "8px 12px", textTransform: "uppercase", letterSpacing: .5, borderBottom: `1px solid ${T.cardBorder}` }}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {recentAttempts.map(a => {
              const student = db.users.find(u => u.id === a.userId);
              const exam = db.exams.find(e => e.id === a.examId);
              const pct = ((a.score / a.total) * 100).toFixed(0);
              const passed = a.score >= (exam?.passingMarks || 0);
              return (
                <tr key={a.id} style={{ borderBottom: `1px solid ${T.cardBorder}` }}>
                  <td style={{ padding: "12px", display: "flex", alignItems: "center", gap: 10 }}>
                    <Avatar initials={student?.avatar || "?"} size={28} />
                    <span style={{ color: T.text, fontSize: 13 }}>{student?.name}</span>
                  </td>
                  <td style={{ padding: "12px", color: T.muted, fontSize: 13 }}>{exam?.title}</td>
                  <td style={{ padding: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: 1, height: 6, background: T.surface, borderRadius: 3, width: 80 }}>
                        <div style={{ width: pct + "%", height: "100%", background: pct >= 60 ? T.green : T.red, borderRadius: 3 }} />
                      </div>
                      <span style={{ color: T.text, fontSize: 13, fontWeight: 700 }}>{a.score}/{a.total}</span>
                    </div>
                  </td>
                  <td style={{ padding: "12px", color: T.muted, fontSize: 13 }}>{Math.floor(a.timeTaken/60)}m {a.timeTaken%60}s</td>
                  <td style={{ padding: "12px" }}><Badge color={passed ? T.green : T.red}>{passed ? "Passed" : "Failed"}</Badge></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ADMIN: EXAM MANAGER
═══════════════════════════════════════════════════════════ */
function ExamManager({ user }) {
  const myClasses = getDB().classes.filter(c => c.teacherId === user.id);
  const [exams, setExams] = useState(getDB().exams.filter(e => e.createdBy === user.id));
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: "", subject: "", duration: 3600, totalMarks: 10, negativeMarking: true, passingMarks: 5, status: "active", classId: myClasses[0]?.id || "", maxAttempts:1, opensAt:"", closesAt:"" });
  const f = (k,v) => setForm(p => ({ ...p, [k]: v }));

  const refresh = () => setExams(getDB().exams.filter(e => e.createdBy === user.id));

  const openNew = () => { setEditing(null); setForm({ title:"", subject:"", duration:3600, totalMarks:10, negativeMarking:true, passingMarks:5, status:"active", classId: myClasses[0]?.id || "", maxAttempts:1, opensAt:"", closesAt:"" }); setShowModal(true); };
  const openEdit = (ex) => { setEditing(ex); setForm({ ...ex }); setShowModal(true); };

  const save = () => {
    if (!form.title || !form.subject) return;
    if (editing) {
      const i = runtimeDB.exams.findIndex(e => e.id === editing.id);
      runtimeDB.exams[i] = { ...editing, ...form };
    } else {
      runtimeDB.exams.push({ id: uid(), ...form, createdBy: user.id, createdAt: new Date().toISOString().slice(0,10) });
    }
    refresh(); setShowModal(false);
  };

  const del = (id) => { runtimeDB.exams = runtimeDB.exams.filter(e => e.id !== id); refresh(); };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h2 style={{ color: T.text, fontSize: 22, fontWeight: 800, margin: 0 }}>Exam Management</h2>
        <button style={css.btn("linear-gradient(135deg,#6366f1,#a855f7)")} onClick={openNew}>+ Create Exam</button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {exams.map(ex => {
          const attempts = getDB().attempts.filter(a => a.examId === ex.id);
          const qs = getDB().questions.filter(q => q.examId === ex.id);
          return (
            <div key={ex.id} style={{ ...css.card(), display: "flex", alignItems: "center", gap: 20 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <span style={{ color: T.text, fontWeight: 700, fontSize: 16 }}>{ex.title}</span>
                  <Badge color={ex.status === "active" ? T.green : T.muted}>{ex.status}</Badge>
                </div>
                <div style={{ color: T.muted, fontSize: 13 }}>{ex.subject} · {qs.length} questions · {ex.totalMarks} marks · {Math.floor(ex.duration/60)} min</div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div style={{ textAlign: "center", marginRight: 8 }}>
                  <div style={{ color: T.text, fontWeight: 700 }}>{attempts.length}</div>
                  <div style={{ color: T.muted, fontSize: 11 }}>Attempts</div>
                </div>
                <button style={css.btn(T.surface, T.muted)} onClick={() => openEdit(ex)}>Edit</button>
                <button style={css.btn(T.red + "22", T.red)} onClick={() => del(ex.id)}>Delete</button>
              </div>
            </div>
          );
        })}
      </div>

      {showModal && (
        <Modal title={editing ? "Edit Exam" : "Create Exam"} onClose={() => setShowModal(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div><label style={css.label}>Assign to Class *</label>
              <select style={css.input} value={form.classId} onChange={e => f("classId",e.target.value)}>
                <option value="">— Select Class —</option>
                {myClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {myClasses.length === 0 && <div style={{ color:T.yellow, fontSize:11, marginTop:4 }}>⚠ Create a class first from "My Classes".</div>}
            </div>
            <div><label style={css.label}>Exam Title</label><input style={css.input} value={form.title} onChange={e => f("title",e.target.value)} placeholder="e.g. Assessment 3 · 2027" /></div>
            <div><label style={css.label}>Subject</label><input style={css.input} value={form.subject} onChange={e => f("subject",e.target.value)} placeholder="e.g. Mathematics" /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div><label style={css.label}>Duration (seconds)</label><input style={css.input} type="number" value={form.duration} onChange={e => f("duration",+e.target.value)} /></div>
              <div><label style={css.label}>Total Marks</label><input style={css.input} type="number" value={form.totalMarks} onChange={e => f("totalMarks",+e.target.value)} /></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div><label style={css.label}>Passing Marks</label><input style={css.input} type="number" value={form.passingMarks} onChange={e => f("passingMarks",+e.target.value)} /></div>
              <div><label style={css.label}>Status</label>
                <select style={css.input} value={form.status} onChange={e => f("status",e.target.value)}>
                  <option value="active">Active</option><option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div><label style={css.label}>Max Attempts</label>
                <select style={css.input} value={form.maxAttempts||1} onChange={e => f("maxAttempts",+e.target.value)}>
                  <option value={1}>1 — No retake</option>
                  <option value={2}>2 attempts</option>
                  <option value={3}>3 attempts</option>
                  <option value={99}>Unlimited</option>
                </select>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:10, paddingTop:22 }}>
                <input type="checkbox" checked={form.negativeMarking} onChange={e => f("negativeMarking",e.target.checked)} id="neg" />
                <label htmlFor="neg" style={{ color: T.text, fontSize: 14 }}>Negative Marking</label>
              </div>
            </div>
            <div style={{ background:T.surface, borderRadius:10, padding:"12px 14px" }}>
              <div style={{ color:T.muted, fontSize:12, fontWeight:700, textTransform:"uppercase", letterSpacing:.5, marginBottom:10 }}>📅 Scheduling (optional)</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <div><label style={css.label}>Opens at</label><input style={css.input} type="datetime-local" value={form.opensAt||""} onChange={e => f("opensAt",e.target.value)} /></div>
                <div><label style={css.label}>Closes at</label><input style={css.input} type="datetime-local" value={form.closesAt||""} onChange={e => f("closesAt",e.target.value)} /></div>
              </div>
              <div style={{ color:T.muted, fontSize:11, marginTop:8 }}>Leave blank for always-open. Students can only start during the window.</div>
            </div>
            <button style={{ ...css.btn("linear-gradient(135deg,#6366f1,#a855f7)"), padding: "12px 0", fontSize: 15 }} onClick={save}>{editing ? "Update Exam" : "Create Exam"}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ADMIN: QUESTION BANK  — with image upload support
═══════════════════════════════════════════════════════════ */
function QuestionBank({ user }) {
  const blankForm = () => ({
    examId:"", subject:"", text:"", image: null,
    optA:"", optB:"", optC:"", optD:"",
    correct:0, marks:1, negMarks:0.25, difficulty:"Medium"
  });
  const [questions, setQuestions]   = useState(getDB().questions);
  const [filterExam, setFilterExam] = useState("all");
  const [showModal, setShowModal]   = useState(false);
  const [form, setForm]             = useState(blankForm());
  const [errors, setErrors]         = useState({});
  const [saved, setSaved]           = useState(false);
  const [dragOver, setDragOver]     = useState(false);
  const fileRef                     = useRef(null);

  const f = (k, v) => { setForm(p => ({ ...p, [k]: v })); setErrors(p => ({ ...p, [k]: "" })); };
  const refresh = () => setQuestions([...getDB().questions]);
  const openModal = () => { setForm(blankForm()); setErrors({}); setSaved(false); setShowModal(true); };
  const closeModal = () => setShowModal(false);

  /* ── image helpers ── */
  const readFile = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => f("image", e.target.result);
    reader.readAsDataURL(file);
  };
  const onFileChange  = (e) => readFile(e.target.files[0]);
  const onDrop        = (e) => { e.preventDefault(); setDragOver(false); readFile(e.dataTransfer.files[0]); };
  const onDragOver    = (e) => { e.preventDefault(); setDragOver(true); };
  const onDragLeave   = () => setDragOver(false);
  const removeImage   = () => f("image", null);

  /* ── validation ── */
  const validate = () => {
    const e = {};
    if (!form.examId)         e.examId  = "Please select an exam";
    if (!form.subject.trim()) e.subject = "Subject is required";
    if (!form.text.trim() && !form.image) e.text = "Question text or image is required";
    if (!form.optA.trim())    e.optA    = "required";
    if (!form.optB.trim())    e.optB    = "required";
    if (!form.optC.trim())    e.optC    = "required";
    if (!form.optD.trim())    e.optD    = "required";
    return e;
  };

  const save = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    const options = [form.optA.trim(), form.optB.trim(), form.optC.trim(), form.optD.trim()];
    runtimeDB.questions.push({
      id: uid(),
      examId: form.examId,
      subject: form.subject.trim(),
      text: form.text.trim(),
      image: form.image || null,
      options,
      correct: form.correct,
      marks: form.marks,
      negMarks: form.negMarks,
      difficulty: form.difficulty
    });
    refresh();
    setSaved(true);
    setTimeout(() => { setForm(blankForm()); setErrors({}); setSaved(false); }, 1500);
  };

  const del = (id) => { runtimeDB.questions = runtimeDB.questions.filter(q => q.id !== id); refresh(); };

  const exams     = user ? getDB().exams.filter(e => e.createdBy === user.id) : getDB().exams;
  const myExamIds = exams.map(e => e.id);
  const filtered  = (filterExam === "all" ? questions.filter(q => myExamIds.includes(q.examId)) : questions.filter(q => q.examId === filterExam));
  const optLabels = ["A","B","C","D"];
  const optKeys   = ["optA","optB","optC","optD"];
  const errBorder = (k) => ({ ...css.input, border: `1px solid ${errors[k] ? T.red : "rgba(255,255,255,0.1)"}` });

  return (
    <div>
      {/* ── header ── */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
        <h2 style={{ color:T.text, fontSize:22, fontWeight:800, margin:0 }}>Question Bank</h2>
        <div style={{ display:"flex", gap:10 }}>
          <select style={{ ...css.input, width:"auto" }} value={filterExam} onChange={e => setFilterExam(e.target.value)}>
            <option value="all">All Exams</option>
            {exams.map(ex => <option key={ex.id} value={ex.id}>{ex.title}</option>)}
          </select>
          <button style={css.btn("linear-gradient(135deg,#6366f1,#a855f7)")} onClick={openModal}>+ Add Question</button>
        </div>
      </div>

      <div style={{ color:T.muted, fontSize:13, marginBottom:16 }}>{filtered.length} question{filtered.length !== 1 ? "s" : ""}</div>

      {/* ── empty state ── */}
      {filtered.length === 0 && (
        <div style={{ ...css.card({ textAlign:"center", padding:56 }) }}>
          <div style={{ fontSize:48, marginBottom:12 }}>❓</div>
          <div style={{ color:T.muted, marginBottom:20 }}>No questions yet. Add your first question!</div>
          <button style={css.btn("linear-gradient(135deg,#6366f1,#a855f7)")} onClick={openModal}>+ Add First Question</button>
        </div>
      )}

      {/* ── question list ── */}
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {filtered.map((q, i) => {
          const exam = exams.find(e => e.id === q.examId);
          return (
            <div key={q.id} style={{ ...css.card({ padding:"16px 20px" }), display:"flex", gap:16, alignItems:"flex-start" }}>
              <div style={{ width:30, height:30, borderRadius:8, background:T.accent+"22", color:T.accentB, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:13, flexShrink:0 }}>{i+1}</div>
              <div style={{ flex:1 }}>
                {/* image thumbnail */}
                {q.image && (
                  <img src={q.image} alt="question"
                    style={{ maxHeight:120, maxWidth:"100%", borderRadius:10, marginBottom:10, border:`1px solid ${T.cardBorder}`, objectFit:"contain", background:"#000" }} />
                )}
                {q.text && <div style={{ color:T.text, fontSize:14, marginBottom:8, lineHeight:1.5 }}>{q.text}</div>}
                <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:8 }}>
                  {q.options.map((opt, j) => (
                    <span key={j} style={{ fontSize:12, padding:"3px 10px", borderRadius:6, background:j===q.correct?T.green+"22":T.surface, color:j===q.correct?T.green:T.muted, border:j===q.correct?`1px solid ${T.green}44`:`1px solid ${T.cardBorder}` }}>
                      {optLabels[j]}. {opt} {j===q.correct?"✓":""}
                    </span>
                  ))}
                </div>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  <Badge color={T.accent}>{q.subject}</Badge>
                  <Badge color={q.difficulty==="Easy"?T.green:q.difficulty==="Hard"?T.red:T.yellow}>{q.difficulty}</Badge>
                  {exam && <Badge color={T.muted}>{exam.title}</Badge>}
                  {q.image && <Badge color={T.purple}>📷 Image</Badge>}
                  <span style={{ color:T.muted, fontSize:11, alignSelf:"center" }}>+{q.marks} / −{q.negMarks} marks</span>
                </div>
              </div>
              <button style={css.btn(T.red+"22", T.red)} onClick={() => del(q.id)}>Delete</button>
            </div>
          );
        })}
      </div>

      {/* ── ADD QUESTION MODAL ── */}
      {showModal && (
        <Modal title="Add New Question" onClose={closeModal}>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

            {/* exam + subject */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <div>
                <label style={css.label}>Exam *</label>
                <select style={errBorder("examId")} value={form.examId} onChange={e => f("examId", e.target.value)}>
                  <option value="">— Select Exam —</option>
                  {exams.map(ex => <option key={ex.id} value={ex.id}>{ex.title}</option>)}
                </select>
                {errors.examId && <div style={{ color:T.red, fontSize:11, marginTop:4 }}>⚠ {errors.examId}</div>}
              </div>
              <div>
                <label style={css.label}>Subject *</label>
                <input style={errBorder("subject")} value={form.subject} onChange={e => f("subject",e.target.value)} placeholder="e.g. Physics" />
                {errors.subject && <div style={{ color:T.red, fontSize:11, marginTop:4 }}>⚠ {errors.subject}</div>}
              </div>
            </div>

            {/* question text */}
            <div>
              <label style={css.label}>Question Text <span style={{ color:T.muted, fontWeight:400, textTransform:"none" }}>(optional if image provided)</span></label>
              <textarea style={{ ...errBorder("text"), height:72, resize:"vertical" }} value={form.text} onChange={e => f("text",e.target.value)} placeholder="Type the question here, or upload an image below..." />
              {errors.text && <div style={{ color:T.red, fontSize:11, marginTop:4 }}>⚠ {errors.text}</div>}
            </div>

            {/* image upload */}
            <div>
              <label style={css.label}>Question Image <span style={{ color:T.muted, fontWeight:400, textTransform:"none" }}>(optional — diagram, graph, figure)</span></label>

              {form.image ? (
                /* preview */
                <div style={{ position:"relative", borderRadius:12, overflow:"hidden", border:`1px solid ${T.cardBorder}`, background:"#000" }}>
                  <img src={form.image} alt="preview" style={{ width:"100%", maxHeight:220, objectFit:"contain", display:"block" }} />
                  <button onClick={removeImage}
                    style={{ position:"absolute", top:8, right:8, width:32, height:32, borderRadius:"50%", background:"rgba(0,0,0,.7)", border:"none", color:"#fff", fontSize:18, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", lineHeight:1 }}>×</button>
                  <div style={{ position:"absolute", bottom:8, left:8 }}>
                    <Badge color={T.green}>✓ Image uploaded</Badge>
                  </div>
                </div>
              ) : (
                /* drop zone */
                <div
                  onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}
                  onClick={() => fileRef.current.click()}
                  style={{ border:`2px dashed ${dragOver ? T.accent : "rgba(255,255,255,0.15)"}`, borderRadius:12, padding:"28px 20px", textAlign:"center", cursor:"pointer", background:dragOver?T.accent+"0d":T.surface, transition:"all .2s" }}>
                  <div style={{ fontSize:36, marginBottom:8 }}>🖼️</div>
                  <div style={{ color:dragOver?T.accentB:T.text, fontWeight:600, fontSize:14, marginBottom:4 }}>
                    {dragOver ? "Drop image here" : "Drag & drop or click to upload"}
                  </div>
                  <div style={{ color:T.muted, fontSize:12 }}>PNG, JPG, GIF, WEBP — stored as base64</div>
                  <input ref={fileRef} type="file" accept="image/*" style={{ display:"none" }} onChange={onFileChange} />
                </div>
              )}
            </div>

            {/* options */}
            <div>
              <label style={css.label}>Answer Options * — click the letter to mark correct</label>
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {optLabels.map((l, i) => (
                  <div key={i} style={{ display:"flex", gap:8, alignItems:"center" }}>
                    <button onClick={() => f("correct", i)}
                      style={{ width:38, height:38, borderRadius:8, flexShrink:0, border:"none", cursor:"pointer", fontWeight:800, fontSize:14, background:form.correct===i?T.green:T.surface, color:form.correct===i?"#fff":T.muted, transition:"all .15s", fontFamily:"inherit" }}>
                      {l}
                    </button>
                    <input
                      style={{ ...errBorder(optKeys[i]), flex:1 }}
                      value={form[optKeys[i]]}
                      onChange={e => f(optKeys[i], e.target.value)}
                      placeholder={`Option ${l}${form.correct===i?" ← correct answer":""}`}
                    />
                  </div>
                ))}
                {(errors.optA||errors.optB||errors.optC||errors.optD) &&
                  <div style={{ color:T.red, fontSize:12 }}>⚠ All 4 options are required</div>}
              </div>
            </div>

            {/* correct answer preview */}
            <div style={{ background:form[optKeys[form.correct]]?T.green+"15":T.surface, border:`1px solid ${form[optKeys[form.correct]]?T.green+"44":T.cardBorder}`, borderRadius:10, padding:"10px 14px", fontSize:13 }}>
              {form[optKeys[form.correct]]
                ? <span><span style={{ color:T.muted }}>Correct answer: </span><span style={{ color:T.green, fontWeight:700 }}>{optLabels[form.correct]}. {form[optKeys[form.correct]]}</span></span>
                : <span style={{ color:T.muted }}>Fill option {optLabels[form.correct]} above…</span>}
            </div>

            {/* marks row */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
              <div><label style={css.label}>Marks</label><input style={css.input} type="number" step=".25" min="0" value={form.marks} onChange={e => f("marks",+e.target.value)} /></div>
              <div><label style={css.label}>Negative Marks</label><input style={css.input} type="number" step=".25" min="0" value={form.negMarks} onChange={e => f("negMarks",+e.target.value)} /></div>
              <div><label style={css.label}>Difficulty</label>
                <select style={css.input} value={form.difficulty} onChange={e => f("difficulty",e.target.value)}>
                  {["Easy","Medium","Hard"].map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
            </div>

            {saved ? (
              <div style={{ background:T.green+"22", border:`1px solid ${T.green}44`, borderRadius:10, padding:"14px 0", textAlign:"center", color:T.green, fontWeight:700, fontSize:15 }}>
                ✅ Question added! You can add another one.
              </div>
            ) : (
              <button style={{ ...css.btn("linear-gradient(135deg,#6366f1,#a855f7)"), padding:"13px 0", fontSize:15 }} onClick={save}>
                Add Question
              </button>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}



/* ═══════════════════════════════════════════════════════════
   ADMIN: STUDENTS
═══════════════════════════════════════════════════════════ */
function StudentsManager({ user }) {
  const db = getDB();
  // Teacher sees only students in their classes; superadmin sees all
  const myClassIds = user && user.role === "teacher" ? db.classes.filter(c => c.teacherId === user.id).map(c => c.id) : null;
  const students = db.users.filter(u => u.role === "student" && (myClassIds === null || (u.classIds||[]).some(cid => myClassIds.includes(cid))));
  return (
    <div>
      <h2 style={{ color: T.text, fontSize: 22, fontWeight: 800, margin: "0 0 24px" }}>Students ({students.length})</h2>
      <div style={css.card()}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>{["Student","Email","Class","Joined","Attempts","Avg Score"].map(h => (
              <th key={h} style={{ color: T.muted, fontSize: 11, fontWeight: 700, textAlign: "left", padding: "8px 14px", textTransform: "uppercase", letterSpacing: .5, borderBottom: `1px solid ${T.cardBorder}` }}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {students.map(s => {
              const attempts = getDB().attempts.filter(a => a.userId === s.id);
              const avg = attempts.length ? (attempts.reduce((sum,a) => sum+(a.score/a.total)*100,0)/attempts.length).toFixed(0) : "—";
              return (
                <tr key={s.id} style={{ borderBottom: `1px solid ${T.cardBorder}` }}>
                  <td style={{ padding: "14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Avatar initials={s.avatar} size={32} color={T.green} />
                      <span style={{ color: T.text, fontWeight: 600 }}>{s.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: "14px", color: T.muted, fontSize: 13 }}>{s.email}</td>
                  <td style={{ padding: "14px" }}>{(s.classIds||[]).length > 0 ? (s.classIds||[]).map(cid => { const cl=db.classes.find(c=>c.id===cid); return cl ? <Badge key={cid} color={T.accent} style={{marginRight:4}}>{cl.name}</Badge> : null; }) : <span style={{color:T.muted,fontSize:12}}>Not enrolled</span>}</td>
                  <td style={{ padding: "14px", color: T.muted, fontSize: 13 }}>{s.joinedAt}</td>
                  <td style={{ padding: "14px", color: T.text, fontWeight: 700 }}>{attempts.length}</td>
                  <td style={{ padding: "14px" }}>
                    {avg !== "—" ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 60, height: 6, background: T.surface, borderRadius: 3 }}>
                          <div style={{ width: avg + "%", height: "100%", background: avg >= 60 ? T.green : T.red, borderRadius: 3 }} />
                        </div>
                        <span style={{ color: T.text, fontSize: 13, fontWeight: 700 }}>{avg}%</span>
                      </div>
                    ) : <span style={{ color: T.muted }}>—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   RESULTS (shared admin+student)
═══════════════════════════════════════════════════════════ */
function ResultsPage({ user }) {
  const [tick, setTick]           = useState(0);
  const [expanded, setExpanded]   = useState(null);
  const [noteInputs, setNoteInputs] = useState({});
  const [alertInputs, setAlertInputs] = useState({}); // { attemptId: { title, message, severity } }
  const refresh = () => setTick(t => t + 1);

  const db           = getDB();
  const isPrivileged = user.role === "teacher" || user.role === "superadmin";
  const myExamIds    = user.role === "teacher" ? db.exams.filter(e => e.createdBy === user.id).map(e => e.id) : null;
  const attempts     = user.role === "superadmin" ? db.attempts
    : user.role === "teacher" ? db.attempts.filter(a => myExamIds.includes(a.examId))
    : db.attempts.filter(a => a.userId === user.id);

  const label        = user.role === "superadmin" ? "All Results" : user.role === "teacher" ? "Class Results" : "My Results";
  const flaggedCount = attempts.filter(a => a.cheatSummary?.flagged).length;
  const totalCheat   = attempts.filter(a => (a.cheatSummary?.total||0) > 0).length;

  const setAction = (aId, action) => {
    const i = runtimeDB.attempts.findIndex(a => a.id === aId);
    if (i < 0) return;
    runtimeDB.attempts[i].cheatSummary = { ...(runtimeDB.attempts[i].cheatSummary||{}), teacherAction: action };
    refresh();
  };
  const saveNote = (aId) => {
    const i = runtimeDB.attempts.findIndex(a => a.id === aId);
    if (i < 0) return;
    runtimeDB.attempts[i].cheatSummary = { ...(runtimeDB.attempts[i].cheatSummary||{}), teacherNote: noteInputs[aId]||"" };
    refresh();
  };
  const addAlert = (aId) => {
    const inp = alertInputs[aId] || {};
    if (!inp.title?.trim()) return;
    const i = runtimeDB.attempts.findIndex(a => a.id === aId);
    if (i < 0) return;
    const existing = runtimeDB.attempts[i].cheatSummary?.customAlerts || [];
    runtimeDB.attempts[i].cheatSummary = {
      ...(runtimeDB.attempts[i].cheatSummary||{}),
      customAlerts: [...existing, { id:uid(), title:inp.title.trim(), message:(inp.message||"").trim(), severity:inp.severity||"high", addedBy:user.name, addedAt:new Date().toISOString() }]
    };
    setAlertInputs(p => ({...p, [aId]: { title:"", message:"", severity:"high" }}));
    refresh();
  };
  const removeAlert = (aId, alertId) => {
    const i = runtimeDB.attempts.findIndex(a => a.id === aId);
    if (i < 0) return;
    runtimeDB.attempts[i].cheatSummary.customAlerts = (runtimeDB.attempts[i].cheatSummary.customAlerts||[]).filter(a => a.id !== alertId);
    refresh();
  };

  const sortedAttempts = [...attempts].sort((a,b) => {
    const af = (a.cheatSummary?.flagged && !a.cheatSummary?.teacherAction) ? 2 : (a.cheatSummary?.total||0) > 0 ? 1 : 0;
    const bf = (b.cheatSummary?.flagged && !b.cheatSummary?.teacherAction) ? 2 : (b.cheatSummary?.total||0) > 0 ? 1 : 0;
    return bf - af || new Date(b.submittedAt) - new Date(a.submittedAt);
  });

  return (
    <div>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
        <div>
          <h2 style={{ color:T.text, fontSize:22, fontWeight:800, margin:"0 0 4px" }}>{label}</h2>
          <p style={{ color:T.muted, margin:0, fontSize:13 }}>{attempts.length} total attempts{isPrivileged && totalCheat > 0 ? ` · ${totalCheat} with activity detected` : ""}</p>
        </div>
        {isPrivileged && flaggedCount > 0 && (
          <div style={{ background:T.red+"15", border:`1px solid ${T.red}33`, borderRadius:10, padding:"10px 18px", display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:20 }}>🚨</span>
            <span style={{ color:T.red, fontWeight:700, fontSize:13 }}>{flaggedCount} flagged — needs review</span>
          </div>
        )}
      </div>

      {attempts.length === 0 ? (
        <div style={{ ...css.card(), textAlign:"center", padding:56 }}>
          <div style={{ fontSize:48, marginBottom:12 }}>📊</div>
          <div style={{ color:T.muted }}>No exam attempts yet.</div>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {sortedAttempts.map(a => {
            const exam     = db.exams.find(e => e.id === a.examId);
            const student  = db.users.find(u => u.id === a.userId);
            const pct      = ((a.score/a.total)*100).toFixed(0);
            const passed   = a.score >= (exam?.passingMarks||0);
            const cs       = a.cheatSummary || {};
            const isOpen   = expanded === a.id;
            const hasCheat = (cs.total||0) > 0 || (cs.customAlerts||[]).length > 0;
            const riskLevel= cs.high >= 3 || (cs.tabSwitch||0) >= 3 ? "HIGH" : cs.high >= 1 || (cs.total||0) >= 3 ? "MEDIUM" : (cs.total||0) > 0 ? "LOW" : "CLEAN";
            const riskColor= { HIGH:T.red, MEDIUM:T.yellow, LOW:"#f97316", CLEAN:T.green }[riskLevel];
            const actionCol= { flagged:T.red, cleared:T.green, invalidated:"#6b7280" };
            const borderCol= cs.flagged && !cs.teacherAction ? T.red : cs.teacherAction==="cleared" ? T.green : cs.teacherAction==="invalidated" ? "#4b5563" : hasCheat ? "#f97316" : "transparent";

            return (
              <div key={a.id} style={{ ...css.card(), borderLeft:`4px solid ${borderCol}`, transition:"border-color .2s" }}>
                {/* ── Row ── */}
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12, flexWrap:"wrap" }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:6 }}>
                      <span style={{ color:T.text, fontWeight:700, fontSize:16 }}>{exam?.title || "Unknown Exam"}</span>
                      {isPrivileged && student && <span style={{ color:T.muted, fontSize:13 }}>— {student.name}</span>}
                    </div>
                    <div style={{ display:"flex", gap:6, flexWrap:"wrap", alignItems:"center" }}>
                      <Badge color={passed?T.green:T.red}>{passed?"Passed":"Failed"}</Badge>
                      <Badge color={T.accent}>{new Date(a.submittedAt).toLocaleDateString()}</Badge>
                      {/* Cheat badges */}
                      {hasCheat && riskLevel !== "CLEAN" && <Badge color={riskColor}>🚨 {riskLevel} RISK · {cs.total||0} event{cs.total!==1?"s":""}</Badge>}
                      {cs.flagged && !cs.teacherAction && <Badge color={T.red}>⚠ FLAGGED</Badge>}
                      {cs.teacherAction === "flagged"     && <Badge color={T.red}>🚨 Marked: Cheating</Badge>}
                      {cs.teacherAction === "cleared"     && <Badge color={T.green}>✓ Cleared</Badge>}
                      {cs.teacherAction === "invalidated" && <Badge color="#6b7280">✗ Invalidated</Badge>}
                      {(cs.customAlerts||[]).length > 0   && <Badge color={T.purple}>🔔 {cs.customAlerts.length} Alert{cs.customAlerts.length>1?"s":""}</Badge>}
                      {cs.teacherNote && <Badge color={T.purple}>📝 Note</Badge>}
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:20, alignItems:"center", flexShrink:0 }}>
                    <Stat label="Score"   value={a.score}  sub={`/${a.total}`}  color={passed?T.green:T.red} />
                    <Stat label="Correct" value={a.correct} color={T.green} />
                    <Stat label="Wrong"   value={a.wrong}   color={T.red} />
                    <Stat label="Time"    value={Math.floor(a.timeTaken/60)+"m"} color={T.yellow} />
                    <button style={{ ...css.btn(isOpen?T.accent:T.surface, isOpen?"#fff":T.muted), padding:"7px 16px", fontSize:12, flexShrink:0 }}
                      onClick={() => setExpanded(isOpen ? null : a.id)}>
                      {isOpen ? "▲ Close" : "▼ Details"}
                    </button>
                  </div>
                </div>
                {/* Score bar */}
                <div style={{ marginTop:12, height:6, background:T.surface, borderRadius:3 }}>
                  <div style={{ width:pct+"%", height:"100%", background:passed?T.green:T.red, borderRadius:3, transition:"width .6s" }} />
                </div>
                <div style={{ color:T.muted, fontSize:11, marginTop:3 }}>{pct}%</div>

                {/* ── EXPANDED ── */}
                {isOpen && (
                  <div style={{ marginTop:20, borderTop:`1px solid ${T.cardBorder}`, paddingTop:20, display:"flex", flexDirection:"column", gap:16 }}>

                    {/* ── Custom Alerts (shown to everyone) ── */}
                    {(cs.customAlerts||[]).length > 0 && (
                      <div>
                        <div style={{ color:T.purple, fontSize:12, fontWeight:700, textTransform:"uppercase", letterSpacing:.5, marginBottom:10 }}>🔔 Teacher Alerts</div>
                        {(cs.customAlerts||[]).map(alert => {
                          const sc = { high:T.red, medium:T.yellow, low:"#f97316" }[alert.severity] || T.muted;
                          return (
                            <div key={alert.id} style={{ background:sc+"12", border:`1px solid ${sc}44`, borderRadius:10, padding:"14px 18px", marginBottom:8, display:"flex", gap:14, alignItems:"flex-start" }}>
                              <div style={{ width:38, height:38, borderRadius:10, background:sc+"22", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>
                                {alert.severity==="high"?"🚨":alert.severity==="medium"?"⚠️":"📋"}
                              </div>
                              <div style={{ flex:1 }}>
                                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
                                  <span style={{ color:T.text, fontWeight:700, fontSize:14 }}>{alert.title}</span>
                                  <span style={{ background:sc+"22", color:sc, fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:20, textTransform:"uppercase" }}>{alert.severity}</span>
                                </div>
                                {alert.message && <div style={{ color:T.muted, fontSize:13, lineHeight:1.5 }}>{alert.message}</div>}
                                <div style={{ color:T.muted, fontSize:11, marginTop:4 }}>Added by {alert.addedBy} · {new Date(alert.addedAt).toLocaleString()}</div>
                              </div>
                              {isPrivileged && (
                                <button style={{ ...css.btn(T.red+"22", T.red), padding:"4px 10px", fontSize:11, flexShrink:0 }} onClick={() => removeAlert(a.id, alert.id)}>✕</button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* ── Cheat Integrity Report ── */}
                    {(cs.total||0) > 0 ? (
                      <div style={{ background:riskColor+"0d", border:`1px solid ${riskColor}33`, borderRadius:12, padding:"16px 20px" }}>
                        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
                          <span style={{ fontSize:22 }}>🔍</span>
                          <span style={{ color:T.text, fontWeight:800, fontSize:15 }}>Integrity Report</span>
                          <span style={{ background:riskColor, color:riskLevel==="MEDIUM"?"#000":"#fff", fontSize:11, fontWeight:800, padding:"3px 12px", borderRadius:20, letterSpacing:.5 }}>
                            {riskLevel} RISK
                          </span>
                          {cs.flagged && <span style={{ background:T.red+"22", color:T.red, fontSize:11, fontWeight:800, padding:"3px 10px", borderRadius:20 }}>AUTO-FLAGGED</span>}
                        </div>
                        {/* Stats */}
                        <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:8, marginBottom:14 }}>
                          {[
                            ["📊", "Total",      cs.total||0,      T.accent],
                            ["🔀", "Tab Switch", cs.tabSwitch||0,  T.red   ],
                            ["📋", "Copy",       cs.copyText||0,   T.red   ],
                            ["🚨", "Alt+Tab",    cs.altTab||0,     T.red   ],
                            ["🛠️", "DevTools",   cs.devTools||0,   T.red   ],
                            ["🔴", "High Sev.",  cs.high||0,       T.red   ],
                          ].map(([icon,label,val,col]) => (
                            <div key={label} style={{ background:"rgba(0,0,0,.2)", borderRadius:8, padding:"8px 4px", textAlign:"center" }}>
                              <div style={{ fontSize:16 }}>{icon}</div>
                              <div style={{ color:(val>0)?col:T.muted, fontWeight:800, fontSize:18 }}>{val}</div>
                              <div style={{ color:T.muted, fontSize:10, marginTop:2 }}>{label}</div>
                            </div>
                          ))}
                        </div>
                        {/* Timeline */}
                        {(cs.logs||[]).length > 0 && (
                          <div style={{ background:"rgba(0,0,0,.2)", borderRadius:8, padding:"10px 14px", maxHeight:160, overflowY:"auto" }}>
                            <div style={{ color:T.muted, fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:.5, marginBottom:8 }}>Incident Timeline</div>
                            {(cs.logs||[]).map((l,i) => {
                              const meta = CHEAT_META[l.type] || { icon:"⚠️", label:l.type };
                              const sc   = SEV_COLOR[l.severity] || T.muted;
                              return (
                                <div key={i} style={{ display:"flex", gap:10, alignItems:"center", padding:"5px 0", borderBottom:`1px solid rgba(255,255,255,.05)` }}>
                                  <span style={{ fontSize:13 }}>{meta.icon}</span>
                                  <span style={{ color:T.muted, fontSize:12, flex:1 }}>{meta.label}</span>
                                  <span style={{ color:T.muted, fontSize:11 }}>{new Date(l.timestamp).toLocaleTimeString()}</span>
                                  <span style={{ background:sc+"22", color:sc, fontSize:10, padding:"2px 8px", borderRadius:10, fontWeight:700, textTransform:"uppercase" }}>{l.severity}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ background:T.green+"0d", border:`1px solid ${T.green}22`, borderRadius:10, padding:"12px 16px", display:"flex", alignItems:"center", gap:10 }}>
                        <span style={{ fontSize:20 }}>✅</span>
                        <span style={{ color:T.green, fontWeight:600, fontSize:13 }}>No suspicious activity detected during this exam.</span>
                      </div>
                    )}

                    {/* ── Teacher / Admin Controls ── */}
                    {isPrivileged && (
                      <div style={{ background:T.surface, borderRadius:12, padding:"16px 20px" }}>
                        <div style={{ color:T.muted, fontSize:12, fontWeight:700, textTransform:"uppercase", letterSpacing:.5, marginBottom:14 }}>
                          👩‍🏫 Teacher Actions
                        </div>

                        {/* Action buttons */}
                        <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:16 }}>
                          {[
                            { action:"flagged",     label:"🚨 Mark as Cheating", active:cs.teacherAction==="flagged",     bg:T.red,    activeBg:T.red   },
                            { action:"cleared",     label:"✓ Clear / Innocent",  active:cs.teacherAction==="cleared",     bg:T.green,  activeBg:T.green },
                            { action:"invalidated", label:"✗ Invalidate Result", active:cs.teacherAction==="invalidated", bg:"#4b5563", activeBg:"#4b5563" },
                          ].map(b => (
                            <button key={b.action}
                              style={{ ...css.btn(b.active ? b.activeBg : b.bg+"22", b.active ? "#fff" : b.bg), padding:"9px 18px", fontSize:13, fontWeight:b.active?800:600 }}
                              onClick={() => setAction(a.id, cs.teacherAction===b.action ? "" : b.action)}>
                              {b.active ? "✓ "+b.label.split(" ").slice(1).join(" ") : b.label}
                            </button>
                          ))}
                        </div>

                        {/* Add Custom Alert */}
                        <div style={{ background:T.card, borderRadius:10, padding:"14px 16px", marginBottom:14 }}>
                          <div style={{ color:T.muted, fontSize:12, fontWeight:700, textTransform:"uppercase", letterSpacing:.5, marginBottom:10 }}>🔔 Add Custom Alert (visible in student result)</div>
                          <div style={{ display:"flex", gap:8, marginBottom:8 }}>
                            <input
                              style={{ ...css.input, flex:1 }}
                              placeholder="Alert title e.g. 'Suspected AI assistance detected'"
                              value={(alertInputs[a.id]||{}).title||""}
                              onChange={e => setAlertInputs(p => ({...p, [a.id]:{...(p[a.id]||{}), title:e.target.value}}))}
                            />
                            <select
                              style={{ ...css.input, width:110 }}
                              value={(alertInputs[a.id]||{}).severity||"high"}
                              onChange={e => setAlertInputs(p => ({...p, [a.id]:{...(p[a.id]||{}), severity:e.target.value}}))}>
                              <option value="high">🔴 High</option>
                              <option value="medium">🟡 Medium</option>
                              <option value="low">🟠 Low</option>
                            </select>
                          </div>
                          <div style={{ display:"flex", gap:8 }}>
                            <textarea
                              style={{ ...css.input, flex:1, height:54, resize:"vertical", fontSize:13 }}
                              placeholder="Optional description — explain what was observed…"
                              value={(alertInputs[a.id]||{}).message||""}
                              onChange={e => setAlertInputs(p => ({...p, [a.id]:{...(p[a.id]||{}), message:e.target.value}}))}
                            />
                            <button
                              style={{ ...css.btn("linear-gradient(135deg,#6366f1,#a855f7)"), padding:"10px 20px", alignSelf:"flex-end", flexShrink:0, opacity:(alertInputs[a.id]||{}).title?.trim()?1:.4 }}
                              onClick={() => addAlert(a.id)}
                              disabled={!(alertInputs[a.id]||{}).title?.trim()}>
                              Add Alert
                            </button>
                          </div>
                        </div>

                        {/* Note */}
                        <div>
                          <div style={{ color:T.muted, fontSize:12, fontWeight:700, textTransform:"uppercase", letterSpacing:.5, marginBottom:8 }}>📝 Internal Note</div>
                          <div style={{ display:"flex", gap:8 }}>
                            <textarea
                              style={{ ...css.input, flex:1, height:56, resize:"vertical", fontSize:13 }}
                              placeholder="Private note about this attempt (not shown to student)…"
                              value={noteInputs[a.id] !== undefined ? noteInputs[a.id] : (cs.teacherNote||"")}
                              onChange={e => setNoteInputs(p => ({...p, [a.id]:e.target.value}))}
                            />
                            <button style={{ ...css.btn(T.accent), padding:"10px 18px", alignSelf:"flex-end", flexShrink:0 }} onClick={() => saveNote(a.id)}>Save</button>
                          </div>
                          {cs.teacherNote && (
                            <div style={{ marginTop:8, background:T.purple+"15", border:`1px solid ${T.purple}33`, borderRadius:8, padding:"8px 12px", color:T.muted, fontSize:12 }}>
                              📝 <em>"{cs.teacherNote}"</em>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   TEACHER DASHBOARD
═══════════════════════════════════════════════════════════ */
function TeacherDashboard({ user }) {
  const db = getDB();
  const myClasses      = db.classes.filter(c => c.teacherId === user.id);
  const myExams        = db.exams.filter(e => e.createdBy === user.id);
  const myStudents     = db.users.filter(u => u.role === "student" && myClasses.some(c => (u.classIds||[]).includes(c.id)));
  const myAttempts     = db.attempts.filter(a => myExams.some(e => e.id === a.examId));
  const avgScore       = myAttempts.length ? (myAttempts.reduce((s,a) => s+(a.score/a.total)*100,0)/myAttempts.length).toFixed(0) : 0;
  const pendingRequests = db.classRequests.filter(r => myClasses.some(c => c.id === r.classId) && r.status === "pending");

  return (
    <div>
      <div style={{ marginBottom:pendingRequests.length > 0 ? 16 : 24 }}>
        <h2 style={{ color:T.text, fontSize:22, fontWeight:800, margin:"0 0 4px" }}>Welcome, {user.name.split(" ")[0]}! 👩‍🏫</h2>
        <p style={{ color:T.muted, margin:0 }}>Subject: {user.subject}</p>
      </div>
      {pendingRequests.length > 0 && (
        <div style={{ background:T.yellow+"15", border:`1px solid ${T.yellow}44`, borderRadius:12, padding:"12px 20px", marginBottom:20, display:"flex", alignItems:"center", gap:12 }}>
          <span style={{ fontSize:20 }}>⏳</span>
          <div><span style={{ color:T.yellow, fontWeight:700 }}>{pendingRequests.length} student join request{pendingRequests.length>1?"s":""} waiting for your approval.</span><span style={{ color:T.muted, fontSize:13 }}> Go to My Classes to review.</span></div>
        </div>
      )}

      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16, marginBottom:28 }}>
        {[
          { label:"My Classes",  value:myClasses.length,  icon:"🏫", color:T.accent  },
          { label:"My Exams",    value:myExams.length,    icon:"📋", color:T.green   },
          { label:"Students",    value:myStudents.length, icon:"👥", color:T.yellow  },
          { label:"Avg Score",   value:avgScore+"%",      icon:"📊", color:T.purple  },
        ].map(s => (
          <div key={s.label} style={{ ...css.card(), display:"flex", alignItems:"center", gap:14 }}>
            <div style={{ width:44, height:44, borderRadius:12, background:s.color+"22", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>{s.icon}</div>
            <div>
              <div style={{ color:T.text, fontSize:24, fontWeight:800 }}>{s.value}</div>
              <div style={{ color:T.muted, fontSize:12 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
        <div style={css.card()}>
          <h3 style={{ color:T.text, margin:"0 0 16px", fontSize:16, fontWeight:700 }}>My Classes</h3>
          {myClasses.length === 0 ? <div style={{ color:T.muted, fontSize:13 }}>No classes yet. Create one from "My Classes".</div> : myClasses.map(cls => {
            const stuCount     = db.users.filter(u => (u.classIds||[]).includes(cls.id)).length;
            const exCount      = db.exams.filter(e => e.classId === cls.id).length;
            const pendingCount = db.classRequests.filter(r => r.classId === cls.id && r.status === "pending").length;
            return (
              <div key={cls.id} style={{ padding:"10px 0", borderBottom:`1px solid ${T.cardBorder}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <div style={{ color:T.text, fontWeight:600, fontSize:14 }}>{cls.name}</div>
                  <div style={{ color:T.muted, fontSize:12 }}>{stuCount} students · {exCount} exams</div>
                </div>
                <Badge color={T.accent}>{cls.id.slice(0,6).toUpperCase()}</Badge>
              </div>
            );
          })}
        </div>
        <div style={css.card()}>
          <h3 style={{ color:T.text, margin:"0 0 16px", fontSize:16, fontWeight:700 }}>Recent Results</h3>
          {myAttempts.length === 0 ? <div style={{ color:T.muted, fontSize:13 }}>No attempts yet.</div> : [...myAttempts].sort((a,b)=>new Date(b.submittedAt)-new Date(a.submittedAt)).slice(0,5).map(a => {
            const student = db.users.find(u => u.id === a.userId);
            const exam    = db.exams.find(e => e.id === a.examId);
            const pct     = ((a.score/a.total)*100).toFixed(0);
            return (
              <div key={a.id} style={{ padding:"10px 0", borderBottom:`1px solid ${T.cardBorder}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <div style={{ color:T.text, fontSize:13, fontWeight:600 }}>{student?.name}</div>
                  <div style={{ color:T.muted, fontSize:12 }}>{exam?.title}</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ color:pct>=60?T.green:T.red, fontWeight:700 }}>{a.score}/{a.total}</div>
                  <div style={{ color:T.muted, fontSize:11 }}>{pct}%</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   STUDENT: EXAM LIST
═══════════════════════════════════════════════════════════ */
function StudentExamList({ user, onStartExam }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(t); }, []);

  const db = getDB();
  const classExams = db.exams.filter(e => e.status === "active" && (user.classIds||[]).includes(e.classId));

  const getExamState = (ex) => {
    const userAttempts = db.attempts.filter(a => a.examId === ex.id && a.userId === user.id);
    const max          = ex.maxAttempts || 1;
    const left         = Math.max(0, max - userAttempts.length);
    const opens        = ex.opensAt  ? new Date(ex.opensAt)  : null;
    const closes       = ex.closesAt ? new Date(ex.closesAt) : null;
    const notYetOpen   = opens  && opens  > now;
    const expired      = closes && closes < now;
    const lastAttempt  = userAttempts.sort((a,b)=>new Date(b.submittedAt)-new Date(a.submittedAt))[0];
    return { userAttempts, max, left, opens, closes, notYetOpen, expired, lastAttempt };
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleString([], {month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}) : "";

  return (
    <div>
      <h2 style={{ color:T.text, fontSize:22, fontWeight:800, margin:"0 0 24px" }}>Available Exams</h2>
      {classExams.length === 0 && (
        <div style={{ ...css.card({textAlign:"center",padding:56}) }}>
          <div style={{ fontSize:48, marginBottom:12 }}>📋</div>
          <div style={{ color:T.muted }}>No active exams in your classes yet.</div>
        </div>
      )}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))", gap:20 }} className="exam-grid">
        {classExams.map(ex => {
          const { userAttempts, max, left, opens, closes, notYetOpen, expired, lastAttempt } = getExamState(ex);
          const qCount   = db.questions.filter(q => q.examId === ex.id).length;
          const cls      = db.classes.find(c => c.id === ex.classId);
          const canStart = !notYetOpen && !expired && left > 0 && qCount > 0;

          return (
            <div key={ex.id} style={{ ...css.card(), display:"flex", flexDirection:"column", gap:14, borderLeft: expired?"4px solid "+T.muted : notYetOpen?"4px solid "+T.yellow : left===0?"4px solid "+T.green : "4px solid "+T.accent }}>
              <div>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8, flexWrap:"wrap", gap:6 }}>
                  <Badge color={T.accent}>{ex.subject}</Badge>
                  <div style={{ display:"flex", gap:6 }}>
                    {expired      && <Badge color={T.muted}>Closed</Badge>}
                    {notYetOpen   && <Badge color={T.yellow}>Scheduled</Badge>}
                    {left === 0 && !expired && !notYetOpen && <Badge color={T.green}>Completed</Badge>}
                    {left > 0 && !expired && !notYetOpen && <Badge color={T.green}>{max===99?"∞":left+" left"}</Badge>}
                  </div>
                </div>
                <h3 style={{ color:T.text, margin:"0 0 4px", fontSize:16, fontWeight:700 }}>{ex.title}</h3>
                <div style={{ color:T.muted, fontSize:12 }}>{cls?.name} · {qCount} Q · {ex.totalMarks} marks · {Math.floor(ex.duration/60)}min</div>
              </div>

              {/* Schedule info */}
              {(opens||closes) && (
                <div style={{ background:T.surface, borderRadius:8, padding:"8px 12px", fontSize:12 }}>
                  {opens  && <div style={{ color:notYetOpen?T.yellow:T.muted }}>🕐 Opens: {fmtDate(opens)}</div>}
                  {closes && <div style={{ color:expired?T.red:T.muted }}>🕐 Closes: {fmtDate(closes)}</div>}
                </div>
              )}

              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, padding:"10px 0", borderTop:`1px solid ${T.cardBorder}`, borderBottom:`1px solid ${T.cardBorder}` }}>
                <div style={{ textAlign:"center" }}>
                  <div style={{ color:T.text, fontWeight:700 }}>{ex.passingMarks}</div>
                  <div style={{ color:T.muted, fontSize:10 }}>Passing</div>
                </div>
                <div style={{ textAlign:"center" }}>
                  <div style={{ color:T.text, fontWeight:700 }}>{ex.negativeMarking?"Yes":"No"}</div>
                  <div style={{ color:T.muted, fontSize:10 }}>Neg. Mark</div>
                </div>
                <div style={{ textAlign:"center" }}>
                  <div style={{ color:T.text, fontWeight:700 }}>{max===99?"∞":max}</div>
                  <div style={{ color:T.muted, fontSize:10 }}>Max Tries</div>
                </div>
              </div>

              {/* Best score */}
              {lastAttempt && (
                <div style={{ background:T.green+"12", border:`1px solid ${T.green}33`, borderRadius:8, padding:"8px 12px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ color:T.green, fontWeight:700, fontSize:13 }}>Best: {lastAttempt.score}/{lastAttempt.total}</span>
                  <span style={{ color:T.muted, fontSize:11 }}>{userAttempts.length}/{max===99?"∞":max} taken</span>
                </div>
              )}

              {/* CTA */}
              {qCount === 0 ? (
                <div style={{ textAlign:"center", color:T.muted, fontSize:13, padding:"8px 0", opacity:.6 }}>No questions yet</div>
              ) : notYetOpen ? (
                <div style={{ background:T.yellow+"15", border:`1px solid ${T.yellow}33`, borderRadius:8, padding:"10px 14px", textAlign:"center", fontSize:13, color:T.yellow, fontWeight:600 }}>
                  Opens {fmtDate(opens)}
                </div>
              ) : expired ? (
                <div style={{ background:T.surface, borderRadius:8, padding:"10px 14px", textAlign:"center", fontSize:13, color:T.muted }}>Exam window closed</div>
              ) : left === 0 ? (
                <div style={{ background:T.green+"12", border:`1px solid ${T.green}33`, borderRadius:8, padding:"10px 14px", textAlign:"center", fontSize:13, color:T.green, fontWeight:600 }}>All attempts used</div>
              ) : (
                <button style={{ ...css.btn("linear-gradient(135deg,#6366f1,#a855f7)"), padding:"11px 0", fontSize:14 }} onClick={() => onStartExam(ex)}>
                  {userAttempts.length > 0 ? `Retake Exam (${left} left) →` : "Start Exam →"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   STUDENT: JOIN CLASS PAGE
═══════════════════════════════════════════════════════════ */
function JoinClassPage({ user, onUserUpdated }) {
  const [code, setCode]       = useState("");
  const [note, setNote]       = useState("");
  const [error, setError]     = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [tick, setTick]       = useState(0); // force re-render after mutations

  const refresh = () => setTick(t => t + 1);

  const myClassIds  = user.classIds || [];
  const myRequests  = getDB().classRequests.filter(r => r.studentId === user.id);

  const handleSendRequest = () => {
    setError(""); setSuccess(""); setLoading(true);
    setTimeout(() => {
      const input = code.trim().toLowerCase();
      const cls   = getDB().classes.find(c => c.id.slice(0,6).toLowerCase() === input || c.id.toLowerCase() === input);
      if (!cls) { setError("❌ Invalid class code. Check with your teacher."); setLoading(false); return; }
      if (myClassIds.includes(cls.id)) { setError("You are already enrolled in this class."); setLoading(false); return; }
      const existing = getDB().classRequests.find(r => r.studentId === user.id && r.classId === cls.id && r.status === "pending");
      if (existing) { setError("You already have a pending request for this class."); setLoading(false); return; }
      // Create request
      runtimeDB.classRequests.push({ id: uid(), studentId: user.id, classId: cls.id, status: "pending", requestedAt: new Date().toISOString(), note: note.trim() });
      setSuccess(`✅ Join request sent to "${cls.name}"! Waiting for teacher approval.`);
      setCode(""); setNote(""); setLoading(false); refresh();
    }, 500);
  };

  const handleLeave = (classId) => {
    if (!window.confirm("Leave this class?")) return;
    const idx = runtimeDB.users.findIndex(u => u.id === user.id);
    runtimeDB.users[idx].classIds = (runtimeDB.users[idx].classIds || []).filter(id => id !== classId);
    // Also clean up approved request
    const reqIdx = runtimeDB.classRequests.findIndex(r => r.studentId === user.id && r.classId === classId);
    if (reqIdx >= 0) runtimeDB.classRequests.splice(reqIdx, 1);
    const updated = { ...user, classIds: runtimeDB.users[idx].classIds };
    onUserUpdated(updated); refresh();
  };

  const handleCancelRequest = (reqId) => {
    runtimeDB.classRequests = runtimeDB.classRequests.filter(r => r.id !== reqId);
    refresh();
  };

  const enrolledClasses = getDB().classes.filter(c => myClassIds.includes(c.id));
  const pendingReqs     = getDB().classRequests.filter(r => r.studentId === user.id && r.status === "pending");
  const rejectedReqs    = getDB().classRequests.filter(r => r.studentId === user.id && r.status === "rejected");
  const allClasses      = getDB().classes;

  return (
    <div style={{ maxWidth: 600 }}>
      <h2 style={{ color: T.text, fontSize: 22, fontWeight: 800, margin: "0 0 6px" }}>My Classes</h2>
      <p style={{ color: T.muted, margin: "0 0 28px", fontSize: 14 }}>You can join multiple classes from different teachers. Enter a class code to send a join request — the teacher will approve or reject it.</p>

      {/* ── Enrolled classes ── */}
      {enrolledClasses.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <h3 style={{ color: T.green, fontSize: 14, fontWeight: 700, margin: "0 0 12px", textTransform:"uppercase", letterSpacing:.5 }}>✓ Enrolled ({enrolledClasses.length})</h3>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {enrolledClasses.map(cls => {
              const teacher = getDB().users.find(u => u.id === cls.teacherId);
              const exams   = getDB().exams.filter(e => e.classId === cls.id && e.status === "active").length;
              return (
                <div key={cls.id} style={{ ...css.card({ padding:"16px 20px" }), border:`1px solid ${T.green}33`, background: T.green + "07", display:"flex", alignItems:"center", gap:14 }}>
                  <div style={{ width:44, height:44, borderRadius:12, background:T.green+"22", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0 }}>🏫</div>
                  <div style={{ flex:1 }}>
                    <div style={{ color:T.text, fontWeight:700, fontSize:15, marginBottom:3 }}>{cls.name}</div>
                    <div style={{ color:T.muted, fontSize:12 }}>👩‍🏫 {teacher?.name || "Unknown"} · {teacher?.subject || ""}</div>
                    {cls.description && <div style={{ color:T.muted, fontSize:12, marginTop:2 }}>{cls.description}</div>}
                    <div style={{ marginTop:6 }}><Badge color={T.accent}>📋 {exams} active exam{exams!==1?"s":""}</Badge></div>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:8 }}>
                    <Badge color={T.green}>Enrolled</Badge>
                    <button style={{ ...css.btn(T.red+"22", T.red), padding:"5px 12px", fontSize:12 }} onClick={() => handleLeave(cls.id)}>Leave</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Pending requests ── */}
      {pendingReqs.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <h3 style={{ color: T.yellow, fontSize: 14, fontWeight: 700, margin: "0 0 12px", textTransform:"uppercase", letterSpacing:.5 }}>⏳ Pending Approval ({pendingReqs.length})</h3>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {pendingReqs.map(req => {
              const cls     = getDB().classes.find(c => c.id === req.classId);
              const teacher = cls ? getDB().users.find(u => u.id === cls.teacherId) : null;
              return (
                <div key={req.id} style={{ ...css.card({ padding:"14px 18px" }), border:`1px solid ${T.yellow}33`, background: T.yellow+"08", display:"flex", alignItems:"center", gap:14 }}>
                  <div style={{ width:40, height:40, borderRadius:10, background:T.yellow+"22", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>⏳</div>
                  <div style={{ flex:1 }}>
                    <div style={{ color:T.text, fontWeight:700 }}>{cls?.name || "Unknown class"}</div>
                    <div style={{ color:T.muted, fontSize:12 }}>👩‍🏫 {teacher?.name || "—"} · Requested {new Date(req.requestedAt).toLocaleDateString()}</div>
                    {req.note && <div style={{ color:T.muted, fontSize:12, fontStyle:"italic", marginTop:2 }}>"{req.note}"</div>}
                  </div>
                  <button style={{ ...css.btn(T.surface, T.muted), padding:"5px 12px", fontSize:12, flexShrink:0 }} onClick={() => handleCancelRequest(req.id)}>Cancel</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Rejected requests ── */}
      {rejectedReqs.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <h3 style={{ color: T.red, fontSize: 14, fontWeight: 700, margin: "0 0 12px", textTransform:"uppercase", letterSpacing:.5 }}>✗ Rejected ({rejectedReqs.length})</h3>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {rejectedReqs.map(req => {
              const cls = getDB().classes.find(c => c.id === req.classId);
              return (
                <div key={req.id} style={{ ...css.card({ padding:"12px 18px" }), border:`1px solid ${T.red}22`, background:T.red+"07", display:"flex", alignItems:"center", gap:12 }}>
                  <span style={{ fontSize:18 }}>❌</span>
                  <div style={{ flex:1 }}>
                    <span style={{ color:T.muted, fontSize:13 }}>{cls?.name || "Unknown"} — request was rejected</span>
                  </div>
                  <button style={{ ...css.btn(T.surface, T.muted), padding:"4px 10px", fontSize:11 }} onClick={() => { runtimeDB.classRequests = runtimeDB.classRequests.filter(r => r.id !== req.id); refresh(); }}>Dismiss</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Send join request form ── */}
      <div style={css.card()}>
        <h3 style={{ color: T.text, fontSize: 15, fontWeight: 700, margin: "0 0 16px" }}>Send a Join Request</h3>
        <div style={{ marginBottom: 12 }}>
          <label style={css.label}>Class Code *</label>
          <input
            style={{ ...css.input, fontSize: 22, fontWeight: 800, letterSpacing: 6, textTransform:"uppercase" }}
            value={code}
            onChange={e => { setCode(e.target.value.toUpperCase().slice(0,6)); setError(""); setSuccess(""); }}
            placeholder="ABC123"
            maxLength={6}
          />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={css.label}>Message to Teacher <span style={{ fontWeight:400, textTransform:"none", color:T.muted }}>(optional)</span></label>
          <textarea style={{ ...css.input, height: 60, resize:"vertical" }} value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. I'm a Grade 11 student interested in joining your Maths batch…" />
        </div>
        {error   && <div style={{ color:T.red,   fontSize:13, background:T.red  +"15", padding:"10px 14px", borderRadius:8, marginBottom:12 }}>{error}</div>}
        {success && <div style={{ color:T.green, fontSize:13, background:T.green+"15", padding:"10px 14px", borderRadius:8, marginBottom:12 }}>{success}</div>}
        <button
          style={{ ...css.btn("linear-gradient(135deg,#6366f1,#a855f7)"), width:"100%", padding:"13px 0", fontSize:15, opacity: (loading || code.length < 4) ? .5 : 1 }}
          onClick={handleSendRequest}
          disabled={loading || code.length < 4}>
          {loading ? "Sending…" : "Send Join Request →"}
        </button>
        <div style={{ marginTop:14, padding:"10px 14px", background:T.surface, borderRadius:10, fontSize:12, color:T.muted, lineHeight:1.6 }}>
          💡 <strong style={{ color:T.text }}>How it works:</strong> Enter the code from your teacher → send a request → teacher approves → you get access to their exams automatically.
        </div>
      </div>

      {/* ── Browse all classes ── */}
      <div style={{ marginTop: 28 }}>
        <h3 style={{ color: T.text, fontSize: 15, fontWeight: 700, margin: "0 0 14px" }}>Browse All Classes</h3>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {allClasses.map(cls => {
            const teacher    = getDB().users.find(u => u.id === cls.teacherId);
            const isEnrolled = myClassIds.includes(cls.id);
            const isPending  = getDB().classRequests.some(r => r.studentId === user.id && r.classId === cls.id && r.status === "pending");
            const stuCount   = getDB().users.filter(u => (u.classIds||[]).includes(cls.id)).length;
            return (
              <div key={cls.id} style={{ ...css.card({ padding:"14px 18px" }), display:"flex", alignItems:"center", gap:14 }}>
                <div style={{ width:42, height:42, borderRadius:10, background:T.accent+"22", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>🏫</div>
                <div style={{ flex:1 }}>
                  <div style={{ color:T.text, fontWeight:700 }}>{cls.name}</div>
                  <div style={{ color:T.muted, fontSize:12 }}>{teacher?.name} · {teacher?.subject} · {stuCount} student{stuCount!==1?"s":""}</div>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
                  <div style={{ background:T.surface, borderRadius:8, padding:"5px 12px", color:T.accentB, fontWeight:800, fontSize:14, letterSpacing:2 }}>{cls.id.slice(0,6).toUpperCase()}</div>
                  {isEnrolled  && <Badge color={T.green}>Enrolled</Badge>}
                  {isPending   && <Badge color={T.yellow}>Pending</Badge>}
                  {!isEnrolled && !isPending && (
                    <button style={{ ...css.btn(T.accent+"22", T.accentB), padding:"6px 14px", fontSize:12 }}
                      onClick={() => { setCode(cls.id.slice(0,6).toUpperCase()); setError(""); setSuccess(""); window.scrollTo(0,99999); }}>
                      Request →
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StudentDashboard({ user, onStartExam, onUserUpdated }) {
  const [localUser, setLocalUser] = useState(user);
  const [tick, setTick] = useState(0);
  const db = getDB();
  const myAttempts  = db.attempts.filter(a => a.userId === localUser.id);
  const avgScore    = myAttempts.length ? (myAttempts.reduce((s,a) => s+(a.score/a.total)*100, 0)/myAttempts.length).toFixed(0) : 0;
  const passed      = myAttempts.filter(a => { const ex = db.exams.find(e=>e.id===a.examId); return a.score>=(ex?.passingMarks||0); }).length;
  const myClassIds  = localUser.classIds || [];
  const myClasses   = db.classes.filter(c => myClassIds.includes(c.id));
  const pendingReqs = db.classRequests.filter(r => r.studentId === localUser.id && r.status === "pending");

  const handleUserUpdated = (updated) => { setLocalUser(updated); onUserUpdated && onUserUpdated(updated); };

  return (
    <div>
      <div style={{ marginBottom:20 }}>
        <h2 style={{ color:T.text, fontSize:22, fontWeight:800, margin:"0 0 4px" }}>Welcome back, {localUser.name.split(" ")[0]}! 👋</h2>
        <p style={{ color:T.muted, margin:0 }}>Here's your learning progress.</p>
      </div>

      {/* Classes row */}
      {myClasses.length > 0 ? (
        <div style={{ marginBottom:20 }}>
          <div style={{ color:T.muted, fontSize:12, fontWeight:700, textTransform:"uppercase", letterSpacing:.5, marginBottom:10 }}>Your Classes</div>
          <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
            {myClasses.map(cls => {
              const teacher = db.users.find(u => u.id === cls.teacherId);
              return (
                <div key={cls.id} style={{ background:T.accent+"15", border:`1px solid ${T.accent}33`, borderRadius:10, padding:"10px 16px", display:"flex", alignItems:"center", gap:10 }}>
                  <span style={{ fontSize:18 }}>🏫</span>
                  <div>
                    <div style={{ color:T.accentB, fontWeight:700, fontSize:13 }}>{cls.name}</div>
                    <div style={{ color:T.muted, fontSize:11 }}>{teacher?.name}</div>
                  </div>
                </div>
              );
            })}
            {pendingReqs.length > 0 && (
              <div style={{ background:T.yellow+"15", border:`1px solid ${T.yellow}33`, borderRadius:10, padding:"10px 16px", display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:18 }}>⏳</span>
                <div style={{ color:T.yellow, fontWeight:700, fontSize:13 }}>{pendingReqs.length} request{pendingReqs.length>1?"s":""} pending</div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ background:T.yellow+"15", border:`1px solid ${T.yellow}44`, borderRadius:12, padding:"14px 20px", marginBottom:20, display:"flex", alignItems:"center", gap:14 }}>
          <span style={{ fontSize:22 }}>⚠️</span>
          <div style={{ flex:1 }}>
            <div style={{ color:T.yellow, fontWeight:700, marginBottom:2 }}>Not enrolled in any class</div>
            <div style={{ color:T.muted, fontSize:13 }}>Go to <strong style={{color:T.text}}>Join Class</strong> in the sidebar, enter your teacher's code to send a request.</div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16, marginBottom:28 }}>
        {[
          { label:"Exams Taken", value:myAttempts.length, icon:"✍️",  color:T.accent  },
          { label:"Avg Score",   value:avgScore+"%",       icon:"📊",  color:T.yellow  },
          { label:"Passed",      value:passed,             icon:"✅",  color:T.green   },
          { label:"Classes",     value:myClasses.length,   icon:"🏫",  color:T.purple  },
        ].map(s => (
          <div key={s.label} style={{ ...css.card(), display:"flex", alignItems:"center", gap:14 }}>
            <div style={{ width:44, height:44, borderRadius:12, background:s.color+"22", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>{s.icon}</div>
            <div>
              <div style={{ color:T.text, fontSize:22, fontWeight:800 }}>{s.value}</div>
              <div style={{ color:T.muted, fontSize:12 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <h3 style={{ color:T.text, fontWeight:700, margin:"0 0 16px" }}>Available Exams</h3>
      <StudentExamList user={localUser} onStartExam={onStartExam} />

      {/* Announcements feed */}
      {(() => {
        const anns = getDB().announcements
          .filter(a => (localUser.classIds||[]).includes(a.classId) && (!a.expiresAt || new Date(a.expiresAt) > new Date()))
          .sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt))
          .slice(0,3);
        if (anns.length === 0) return null;
        return (
          <div style={{ marginTop:28 }}>
            <h3 style={{ color:T.text, fontWeight:700, margin:"0 0 16px" }}>📢 Announcements</h3>
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {anns.map(ann => {
                const cls     = getDB().classes.find(c=>c.id===ann.classId);
                const teacher = getDB().users.find(u=>u.id===ann.teacherId);
                return (
                  <div key={ann.id} style={{ ...css.card({padding:"14px 20px"}), borderLeft:`4px solid ${T.accent}` }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                      <Badge color={T.accent}>{cls?.name}</Badge>
                      <span style={{ color:T.muted, fontSize:11 }}>{new Date(ann.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div style={{ color:T.text, fontWeight:700, marginBottom:4 }}>{ann.title}</div>
                    <div style={{ color:T.muted, fontSize:13, lineHeight:1.5 }}>{ann.body}</div>
                    <div style={{ color:T.muted, fontSize:11, marginTop:6 }}>— {teacher?.name}</div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   EXAM TAKING SCREEN
═══════════════════════════════════════════════════════════ */
const STATUS_Q = { NV:"nv", NA:"na", ANS:"ans", MRK:"mrk", AMRK:"amrk" };
const qStatusColor = { nv:"#374151", na:T.red, ans:T.green, mrk:T.purple, amrk:T.purple };

/* helper: log a cheat event */
function logCheat(studentId, examId, type, detail, severity = "medium") {
  runtimeDB.cheatLogs.push({
    id: uid(), studentId, examId, type, detail, severity,
    timestamp: new Date().toISOString(),
    seen: false,
  });
}

function ExamScreen({ exam, user, onFinish }) {
  const questions = getDB().questions.filter(q => q.examId === exam.id);
  const [cur, setCur]               = useState(0);
  const [answers, setAnswers]       = useState({});
  const [statuses, setStatuses]     = useState(() => { const s={}; questions.forEach(q=>s[q.id]=STATUS_Q.NV); return s; });
  const [sel, setSel]               = useState(null);
  const [timeLeft, setTimeLeft]     = useState(exam.duration);
  const [submitted, setSubmitted]   = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [resultData, setResultData] = useState(null);
  const [cheatAlert, setCheatAlert] = useState(null); // { type, count }
  const tabSwitchCount              = useRef(0);
  const blurCount                   = useRef(0);

  /* ── Anti-cheat: tab / window visibility ── */
  useEffect(() => {
    if (submitted) return;

    const onVisibilityChange = () => {
      if (document.hidden) {
        tabSwitchCount.current += 1;
        const n = tabSwitchCount.current;
        const detail = `Tab switch #${n} at ${new Date().toLocaleTimeString()}`;
        logCheat(user.id, exam.id, "TAB_SWITCH", detail, n >= 3 ? "high" : "medium");
        setCheatAlert({ type: "TAB_SWITCH", count: n });
        setTimeout(() => setCheatAlert(null), 4000);
      }
    };

    const onBlur = () => {
      blurCount.current += 1;
      const n = blurCount.current;
      const detail = `Window lost focus #${n} at ${new Date().toLocaleTimeString()}`;
      logCheat(user.id, exam.id, "WINDOW_BLUR", detail, n >= 3 ? "high" : "low");
    };

    const onContextMenu = (e) => {
      e.preventDefault();
      logCheat(user.id, exam.id, "RIGHT_CLICK", `Right-click at ${new Date().toLocaleTimeString()}`, "low");
      setCheatAlert({ type: "RIGHT_CLICK", count: 1 });
      setTimeout(() => setCheatAlert(null), 2500);
    };

    const onCopy = () => {
      logCheat(user.id, exam.id, "COPY_TEXT", `Text copy attempted at ${new Date().toLocaleTimeString()}`, "medium");
      setCheatAlert({ type: "COPY_TEXT", count: 1 });
      setTimeout(() => setCheatAlert(null), 2500);
    };

    const onKeyDown = (e) => {
      // Detect common AI / search shortcuts
      const key = e.key?.toLowerCase();
      const ctrl = e.ctrlKey || e.metaKey;
      // Ctrl+C / Ctrl+A / Ctrl+V
      if (ctrl && (key === "c" || key === "a")) {
        logCheat(user.id, exam.id, "KEYBOARD_SHORTCUT", `Ctrl+${key.toUpperCase()} pressed`, "medium");
      }
      // Alt+Tab (can't fully block but can detect Alt key combos)
      if (e.altKey && key === "tab") {
        logCheat(user.id, exam.id, "ALT_TAB", `Alt+Tab attempted at ${new Date().toLocaleTimeString()}`, "high");
        setCheatAlert({ type: "ALT_TAB", count: 1 });
        setTimeout(() => setCheatAlert(null), 3000);
      }
      // PrintScreen
      if (key === "printscreen") {
        logCheat(user.id, exam.id, "SCREENSHOT", `PrintScreen key at ${new Date().toLocaleTimeString()}`, "medium");
        setCheatAlert({ type: "SCREENSHOT", count: 1 });
        setTimeout(() => setCheatAlert(null), 2500);
      }
      // F12 / DevTools
      if (key === "f12" || (ctrl && e.shiftKey && (key === "i" || key === "j" || key === "c"))) {
        e.preventDefault();
        logCheat(user.id, exam.id, "DEVTOOLS", `DevTools shortcut at ${new Date().toLocaleTimeString()}`, "high");
        setCheatAlert({ type: "DEVTOOLS", count: 1 });
        setTimeout(() => setCheatAlert(null), 3000);
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onBlur);
    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("copy", onCopy);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [submitted]);

  useEffect(() => {
    if (questions[cur]) {
      setSel(answers[questions[cur].id] ?? null);
      setStatuses(p => { const s={...p}; if(s[questions[cur].id]===STATUS_Q.NV) s[questions[cur].id]=STATUS_Q.NA; return s; });
    }
  }, [cur]);

  useEffect(() => {
    if (submitted) return;
    const id = setInterval(() => setTimeLeft(t => { if(t<=1){clearInterval(id);doSubmit();return 0;}return t-1;}), 1000);
    return () => clearInterval(id);
  }, [submitted]);

  const fmt = s => `${String(Math.floor(s/3600)).padStart(2,"0")}:${String(Math.floor((s%3600)/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;

  const saveNext = () => {
    const qId = questions[cur].id;
    const updated = { ...answers };
    if (sel !== null) updated[qId] = sel;
    setAnswers(updated);
    setStatuses(p => { const s={...p}; s[qId] = sel!==null?(p[qId]===STATUS_Q.MRK||p[qId]===STATUS_Q.AMRK?STATUS_Q.AMRK:STATUS_Q.ANS):STATUS_Q.NA; return s; });
    if (cur < questions.length-1) setCur(c=>c+1);
  };

  const markReview = () => {
    const qId = questions[cur].id;
    const updated = { ...answers };
    if (sel !== null) updated[qId] = sel;
    setAnswers(updated);
    setStatuses(p => { const s={...p}; s[qId]=sel!==null?STATUS_Q.AMRK:STATUS_Q.MRK; return s; });
    if (cur < questions.length-1) setCur(c=>c+1);
  };

  const clearResp = () => {
    const qId = questions[cur].id;
    setSel(null);
    setAnswers(p => { const a={...p}; delete a[qId]; return a; });
    setStatuses(p => ({...p,[qId]:STATUS_Q.NA}));
  };

  const doSubmit = useCallback(() => {
    let score=0, correct=0, wrong=0, skipped=0;
    questions.forEach(q => {
      if (answers[q.id] !== undefined) {
        if (answers[q.id] === q.correct) { score+=q.marks; correct++; }
        else { score-=q.negMarks; wrong++; }
      } else skipped++;
    });
    score = Math.max(0, parseFloat(score.toFixed(2)));
    // Attach cheat summary to attempt
    const myLogs      = runtimeDB.cheatLogs.filter(l => l.studentId===user.id && l.examId===exam.id);
    const cheatSummary = {
      total:    myLogs.length,
      high:     myLogs.filter(l=>l.severity==="high").length,
      medium:   myLogs.filter(l=>l.severity==="medium").length,
      low:      myLogs.filter(l=>l.severity==="low").length,
      tabSwitch: myLogs.filter(l=>l.type==="TAB_SWITCH").length,
      copyText:  myLogs.filter(l=>l.type==="COPY_TEXT").length,
      devTools:  myLogs.filter(l=>l.type==="DEVTOOLS").length,
      altTab:    myLogs.filter(l=>l.type==="ALT_TAB").length,
      logs:      myLogs,
      flagged:   myLogs.filter(l=>l.severity==="high").length >= 2 || myLogs.filter(l=>l.type==="TAB_SWITCH").length >= 3,
      teacherNote: "",   // teacher can add a note
      teacherAction: "", // "cleared" | "flagged" | "invalidated"
    };
    const attempt = { id:uid(), examId:exam.id, userId:user.id, score, total:exam.totalMarks, correct, wrong, skipped, timeTaken:exam.duration-timeLeft, submittedAt:new Date().toISOString(), answers, cheatSummary };
    runtimeDB.attempts.push(attempt);
    // Notify student their result is ready
    pushNotif(user.id, "result", "Your result is ready", `${exam.title}: ${score}/${exam.totalMarks}`, "results");
    // Notify teacher if flagged
    if (cheatSummary.flagged) {
      const examObj    = runtimeDB.exams.find(e=>e.id===exam.id);
      const teacherId  = examObj?.createdBy;
      if (teacherId) pushNotif(teacherId, "cheat", `Cheat alert: ${user.name}`, `${cheatSummary.total} incidents during ${exam.title}`, "cheatlogs");
    }
    setResultData({ score, correct, wrong, skipped, attempt, questions, cheatSummary });
    setSubmitted(true);
  }, [answers, questions, timeLeft]);

  const isUrgent = timeLeft < 300;

  const cheatMessages = {
    TAB_SWITCH:        { icon:"🚨", title:"Tab Switch Detected!", msg:"Switching tabs during an exam is flagged as suspicious. Your teacher has been notified.", color: T.red },
    WINDOW_BLUR:       { icon:"⚠️", title:"Focus Lost",           msg:"You left the exam window. This has been recorded.", color: T.yellow },
    RIGHT_CLICK:       { icon:"🖱️", title:"Right-Click Disabled", msg:"Right-clicking is not allowed during the exam.", color: T.yellow },
    COPY_TEXT:         { icon:"📋", title:"Copy Detected!",       msg:"Copying exam content is flagged. Your teacher has been notified.", color: T.red },
    ALT_TAB:           { icon:"🚨", title:"Alt+Tab Detected!",    msg:"Attempting to switch windows has been flagged.", color: T.red },
    SCREENSHOT:        { icon:"📸", title:"Screenshot Detected!", msg:"Taking screenshots during an exam is not allowed.", color: T.red },
    DEVTOOLS:          { icon:"🛠️", title:"DevTools Blocked!",    msg:"Opening browser developer tools is flagged as suspicious.", color: T.red },
  };

  // RESULT VIEW
  if (submitted && resultData) {
    const { score, correct, wrong, skipped } = resultData;
    const cs      = resultData.cheatSummary || {};
    const pct     = ((score/exam.totalMarks)*100).toFixed(0);
    const passed  = score >= exam.passingMarks;
    const riskLevel = (cs.high>=3||(cs.tabSwitch||0)>=3) ? "HIGH" : (cs.high>=1||(cs.total||0)>=3) ? "MEDIUM" : (cs.total||0)>0 ? "LOW" : "CLEAN";
    const riskColor = { HIGH:T.red, MEDIUM:T.yellow, LOW:"#f97316", CLEAN:T.green }[riskLevel];
    // Pull the live attempt from DB (teacher may have added alerts after submit)
    const liveAttempt = getDB().attempts.find(a => a.id === resultData.attempt?.id) || resultData.attempt;
    const liveCs = liveAttempt?.cheatSummary || cs;

    return (
      <div style={{ minHeight:"100vh", background:T.bg, fontFamily:"'Outfit','Segoe UI',sans-serif", padding:"40px 20px" }}>
        <div style={{ maxWidth:740, margin:"0 auto" }}>

          {/* Hero */}
          <div style={{ textAlign:"center", marginBottom:28 }}>
            <div style={{ fontSize:60 }}>{passed?"🎉":"📚"}</div>
            <h1 style={{ color:T.text, fontSize:28, margin:"12px 0 4px" }}>{passed?"Congratulations!":"Keep Practicing!"}</h1>
            <p style={{ color:T.muted, margin:0 }}>{exam.title}</p>
          </div>

          {/* ── Custom Teacher Alerts ── shown prominently if any */}
          {(liveCs.customAlerts||[]).length > 0 && (
            <div style={{ marginBottom:24 }}>
              {(liveCs.customAlerts||[]).map(alert => {
                const sc = { high:T.red, medium:T.yellow, low:"#f97316" }[alert.severity] || T.muted;
                return (
                  <div key={alert.id} style={{ background:sc+"12", border:`2px solid ${sc}55`, borderRadius:14, padding:"18px 22px", marginBottom:10, display:"flex", gap:14, alignItems:"flex-start" }}>
                    <div style={{ width:46, height:46, borderRadius:12, background:sc+"22", display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, flexShrink:0 }}>
                      {alert.severity==="high"?"🚨":alert.severity==="medium"?"⚠️":"📋"}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                        <span style={{ color:T.text, fontWeight:800, fontSize:16 }}>{alert.title}</span>
                        <span style={{ background:sc, color:alert.severity==="medium"?"#000":"#fff", fontSize:11, fontWeight:800, padding:"3px 10px", borderRadius:20, textTransform:"uppercase" }}>{alert.severity}</span>
                      </div>
                      {alert.message && <div style={{ color:"#cbd5e1", fontSize:13, lineHeight:1.6 }}>{alert.message}</div>}
                      <div style={{ color:T.muted, fontSize:11, marginTop:4 }}>Issued by {alert.addedBy}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Integrity Report ── */}
          {(cs.total||0) > 0 && (
            <div style={{ background:riskColor+"0d", border:`2px solid ${riskColor}44`, borderRadius:16, padding:"20px 24px", marginBottom:24 }}>
              <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
                <div style={{ width:50, height:50, borderRadius:14, background:riskColor+"22", display:"flex", alignItems:"center", justifyContent:"center", fontSize:26, flexShrink:0 }}>
                  {riskLevel==="HIGH"?"🚨":riskLevel==="MEDIUM"?"⚠️":"📋"}
                </div>
                <div>
                  <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}>
                    <span style={{ color:T.text, fontWeight:800, fontSize:17 }}>Exam Integrity Report</span>
                    <span style={{ background:riskColor, color:riskLevel==="MEDIUM"?"#000":"#fff", fontSize:11, fontWeight:800, padding:"3px 12px", borderRadius:20, letterSpacing:.5 }}>{riskLevel} RISK</span>
                    {cs.flagged && <span style={{ background:T.red+"22", color:T.red, fontSize:11, fontWeight:800, padding:"3px 10px", borderRadius:20 }}>⚠ FLAGGED</span>}
                  </div>
                  <div style={{ color:T.muted, fontSize:13 }}>{cs.total} suspicious event{cs.total!==1?"s":""} recorded. Your teacher has been notified.</div>
                </div>
              </div>
              {/* Breakdown */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom: (cs.logs||[]).length?16:0 }}>
                {[["🔀","Tab Switches",cs.tabSwitch||0],["📋","Copy Attempts",cs.copyText||0],["🚨","Alt+Tab",cs.altTab||0],["🛠️","DevTools",cs.devTools||0]].map(([icon,label,val]) => (
                  <div key={label} style={{ background:"rgba(0,0,0,.2)", borderRadius:10, padding:"10px 8px", textAlign:"center" }}>
                    <div style={{ fontSize:20, marginBottom:4 }}>{icon}</div>
                    <div style={{ color:val>0?T.red:T.muted, fontWeight:800, fontSize:20 }}>{val}</div>
                    <div style={{ color:T.muted, fontSize:11 }}>{label}</div>
                  </div>
                ))}
              </div>
              {/* Timeline */}
              {(cs.logs||[]).length > 0 && (
                <div style={{ background:"rgba(0,0,0,.25)", borderRadius:10, padding:"12px 16px", maxHeight:150, overflowY:"auto" }}>
                  <div style={{ color:T.muted, fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:.5, marginBottom:8 }}>Incident Timeline</div>
                  {(cs.logs||[]).map((l,i) => {
                    const meta = CHEAT_META[l.type] || { icon:"⚠️", label:l.type };
                    const sc   = SEV_COLOR[l.severity] || T.muted;
                    return (
                      <div key={i} style={{ display:"flex", gap:10, alignItems:"center", padding:"5px 0", borderBottom:`1px solid rgba(255,255,255,.06)` }}>
                        <span style={{ fontSize:13 }}>{meta.icon}</span>
                        <span style={{ color:T.muted, fontSize:12, flex:1 }}>{meta.label}</span>
                        <span style={{ color:T.muted, fontSize:11 }}>{new Date(l.timestamp).toLocaleTimeString()}</span>
                        <span style={{ background:sc+"22", color:sc, fontSize:10, padding:"2px 8px", borderRadius:10, fontWeight:700, textTransform:"uppercase" }}>{l.severity}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Score cards */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:20 }}>
            {[["Score",score+"/"+exam.totalMarks,passed?T.green:T.red],["Correct",correct,T.green],["Wrong",wrong,T.red],["Skipped",skipped,T.muted]].map(([l,v,c])=>(
              <div key={l} style={{ ...css.card({textAlign:"center",padding:"20px 10px"}) }}>
                <div style={{ color:c, fontSize:28, fontWeight:800 }}>{v}</div>
                <div style={{ color:T.muted, fontSize:12, marginTop:4 }}>{l}</div>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div style={{ ...css.card(), marginBottom:20 }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
              <span style={{ color:T.text, fontWeight:700 }}>Score: {pct}%</span>
              <div style={{ display:"flex", gap:8 }}>
                {liveCs.teacherAction==="invalidated" && <Badge color="#6b7280">✗ Invalidated by Teacher</Badge>}
                {liveCs.teacherAction==="flagged"     && <Badge color={T.red}>🚨 Marked: Cheating</Badge>}
                {liveCs.teacherAction==="cleared"     && <Badge color={T.green}>✓ Cleared by Teacher</Badge>}
                <Badge color={passed?T.green:T.red}>{passed?"PASSED":"FAILED"}</Badge>
              </div>
            </div>
            <div style={{ height:12, background:T.surface, borderRadius:6 }}>
              <div style={{ width:pct+"%", height:"100%", background:passed?T.green:T.red, borderRadius:6, transition:"width .8s" }} />
            </div>
          </div>

          {/* Answer Key */}
          <div style={css.card()}>
            <h3 style={{ color:T.text, margin:"0 0 16px" }}>Answer Key</h3>
            {resultData.questions.map((q,i) => {
              const ua=answers[q.id], isC=ua===q.correct, isS=ua===undefined;
              return (
                <div key={q.id} style={{ padding:"14px 0", borderBottom:`1px solid ${T.cardBorder}`, display:"flex", gap:12 }}>
                  <div style={{ width:28,height:28,borderRadius:"50%",background:isS?T.surface:isC?T.green:T.red,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,flexShrink:0 }}>{i+1}</div>
                  <div style={{ flex:1 }}>
                    {q.image && <img src={q.image} alt="q" style={{ maxHeight:80, maxWidth:"100%", borderRadius:6, marginBottom:6, objectFit:"contain", background:"#000", display:"block" }} />}
                    {q.text && <div style={{ color:T.text, fontSize:13, marginBottom:6 }}>{q.text}</div>}
                    <div style={{ fontSize:12, color:T.green }}>✓ {q.options[q.correct]}</div>
                    {!isS && !isC && <div style={{ fontSize:12, color:T.red }}>✗ Your answer: {q.options[ua]}</div>}
                    {isS && <div style={{ fontSize:12, color:T.muted }}>— Skipped</div>}
                  </div>
                  <div style={{ color:isS?T.muted:isC?T.green:T.red, fontWeight:700, fontSize:13 }}>{isS?"0":isC?"+"+q.marks:"-"+q.negMarks}</div>
                </div>
              );
            })}
          </div>

          <div style={{ textAlign:"center", marginTop:24 }}>
            <button style={{ ...css.btn("linear-gradient(135deg,#6366f1,#a855f7)"), padding:"12px 40px", fontSize:15 }} onClick={onFinish}>Back to Dashboard</button>
          </div>
        </div>
      </div>
    );
  }
  if (!questions.length) return <div style={{color:T.muted,padding:40}}>No questions in this exam.</div>;
  const q = questions[cur];
  const ansCounts = { ans:Object.values(statuses).filter(s=>s===STATUS_Q.ANS||s===STATUS_Q.AMRK).length, na:Object.values(statuses).filter(s=>s===STATUS_Q.NA).length, nv:Object.values(statuses).filter(s=>s===STATUS_Q.NV).length, mrk:Object.values(statuses).filter(s=>s===STATUS_Q.MRK||s===STATUS_Q.AMRK).length };

  return (
    <div style={{ height:"100vh", display:"flex", flexDirection:"column", background:"#f8fafc", fontFamily:"'Outfit','Segoe UI',sans-serif" }}>
      {/* TOP */}
      <div style={{ background:T.card, borderBottom:`1px solid ${T.cardBorder}`, padding:"0 24px", height:56, display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
        <div style={{ color:T.text, fontWeight:800, fontSize:16 }}>{exam.title}</div>
        <div style={{ display:"flex", alignItems:"center", gap:8, background:isUrgent?"rgba(239,68,68,0.15)":"rgba(255,255,255,0.06)", border:`1px solid ${isUrgent?T.red:"rgba(255,255,255,0.1)"}`, borderRadius:10, padding:"6px 16px" }}>
          <span>⏱</span>
          <span style={{ color:isUrgent?T.red:T.text, fontWeight:800, fontSize:17, fontVariantNumeric:"tabular-nums" }}>{fmt(timeLeft)}</span>
        </div>
        <button style={css.btn(T.red, "#fff")} onClick={() => setConfirmSubmit(true)}>Submit</button>
      </div>

      <div style={{ flex:1, display:"flex", overflow:"hidden" }}>
        {/* QUESTION */}
        <div style={{ flex:1, overflow:"auto", padding:"28px 36px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:20 }}>
            <Badge color={T.accent}>{q.subject}</Badge>
            <span style={{ color:T.muted, fontSize:13 }}>Q {cur+1} / {questions.length}</span>
            <div style={{ marginLeft:"auto" }}>
              <Badge color={T.green}>+{q.marks}</Badge>&nbsp;
              {q.negMarks > 0 && <Badge color={T.red}>−{q.negMarks}</Badge>}
            </div>
          </div>
          <div style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:16, padding:"28px 32px", marginBottom:24, boxShadow:"0 1px 6px rgba(0,0,0,.04)" }}>
            {q.image && (
              <div style={{ marginBottom: q.text ? 20 : 0, textAlign:"center", background:"#f8fafc", borderRadius:10, padding:12, border:"1px solid #e2e8f0" }}>
                <img src={q.image} alt="Question diagram"
                  style={{ maxWidth:"100%", maxHeight:260, objectFit:"contain", borderRadius:8, display:"block", margin:"0 auto" }} />
              </div>
            )}
            {q.text && <p style={{ color:"#1e293b", fontSize:18, lineHeight:1.7, margin:"0", fontWeight:500 }}>{q.text}</p>}
            {!q.text && !q.image && <p style={{ color:"#94a3b8", margin:0 }}>No question content.</p>}
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:12, marginBottom:32 }}>
            {q.options.map((opt,i) => {
              const isSel = sel===i;
              return (
                <button key={i} onClick={()=>setSel(i)} style={{ display:"flex", alignItems:"center", gap:16, padding:"16px 22px", background:isSel?"linear-gradient(135deg,#eff6ff,#e0f2fe)":"#fff", border:`2px solid ${isSel?"#3b82f6":"#e2e8f0"}`, borderRadius:12, cursor:"pointer", textAlign:"left", transition:"all .15s", boxShadow:isSel?"0 0 0 3px rgba(59,130,246,.15)":"0 1px 3px rgba(0,0,0,.04)", fontFamily:"inherit" }}>
                  <div style={{ width:36,height:36,borderRadius:"50%",background:isSel?"#3b82f6":"#f1f5f9",border:`2px solid ${isSel?"#3b82f6":"#cbd5e1"}`,display:"flex",alignItems:"center",justifyContent:"center",color:isSel?"#fff":"#64748b",fontWeight:700,fontSize:14,flexShrink:0 }}>{["A","B","C","D"][i]}</div>
                  <span style={{ color:isSel?"#1d4ed8":"#334155", fontSize:15, fontWeight:isSel?600:400 }}>{opt}</span>
                </button>
              );
            })}
          </div>
          <div style={{ display:"flex", justifyContent:"space-between" }}>
            <div style={{ display:"flex", gap:10 }}>
              <button style={{ ...css.btn(T.purple), padding:"11px 20px" }} onClick={markReview}>Mark & Next</button>
              <button style={{ ...css.btn(T.surface, T.muted), padding:"11px 20px" }} onClick={clearResp}>Clear</button>
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button disabled={cur===0} style={{ ...css.btn(T.surface,T.muted), padding:"11px 18px", opacity:cur===0?.4:1 }} onClick={()=>setCur(c=>c-1)}>← Prev</button>
              <button style={{ ...css.btn("linear-gradient(135deg,#16a34a,#15803d)"), padding:"11px 24px" }} onClick={saveNext}>Save & Next →</button>
            </div>
          </div>
        </div>

        {/* PANEL */}
        <div style={{ width:260, background:T.card, borderLeft:`1px solid ${T.cardBorder}`, overflow:"auto", flexShrink:0 }}>
          <div style={{ padding:"16px 18px", borderBottom:`1px solid ${T.cardBorder}` }}>
            <div style={{ fontSize:11, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:.5, marginBottom:10 }}>Legend</div>
            {[[STATUS_Q.ANS,"Answered",ansCounts.ans,T.green],[STATUS_Q.NA,"Not Answered",ansCounts.na,T.red],[STATUS_Q.NV,"Not Visited",ansCounts.nv,"#374151"],[STATUS_Q.MRK,"Marked",ansCounts.mrk,T.purple]].map(([s,l,c,col])=>(
              <div key={s} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:7 }}>
                <div style={{ width:24,height:24,borderRadius:6,background:col,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700 }}>{c}</div>
                <span style={{ color:T.muted, fontSize:12 }}>{l}</span>
              </div>
            ))}
          </div>
          <div style={{ padding:"16px 18px" }}>
            <div style={{ fontSize:11, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:.5, marginBottom:12 }}>Questions</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:6 }}>
              {questions.map((question,i) => {
                const st = statuses[question.id];
                const isActive = i===cur;
                return (
                  <button key={question.id} onClick={()=>setCur(i)} style={{ aspectRatio:"1", borderRadius:7, background:isActive?"#1d4ed8":qStatusColor[st], color:"#fff", border:isActive?"2px solid #60a5fa":"2px solid transparent", fontWeight:700, fontSize:12, cursor:"pointer", transition:"all .15s" }}>{i+1}</button>
                );
              })}
            </div>
          </div>
          <div style={{ padding:"0 18px 20px" }}>
            <button style={{ ...css.btn(T.red), width:"100%", padding:"12px 0", fontSize:14 }} onClick={()=>setConfirmSubmit(true)}>Submit Test</button>
          </div>
        </div>
      </div>

      {/* ── Cheat warning overlay ── */}
      {cheatAlert && (() => {
        const msg = cheatMessages[cheatAlert.type] || { icon:"⚠️", title:"Warning", msg:"Suspicious activity detected.", color: T.red };
        return (
          <div style={{ position:"fixed", top:24, left:"50%", transform:"translateX(-50%)", zIndex:99999, minWidth:360, maxWidth:480, background:"#0f0f0f", border:`2px solid ${msg.color}`, borderRadius:16, padding:"20px 24px", boxShadow:`0 0 40px ${msg.color}44`, fontFamily:"'Outfit','Segoe UI',sans-serif", animation:"slideDown .3s ease" }}>
            <div style={{ display:"flex", gap:14, alignItems:"flex-start" }}>
              <span style={{ fontSize:28, flexShrink:0 }}>{msg.icon}</span>
              <div>
                <div style={{ color:msg.color, fontWeight:800, fontSize:16, marginBottom:4 }}>{msg.title}</div>
                <div style={{ color:"#cbd5e1", fontSize:13, lineHeight:1.5 }}>{msg.msg}</div>
                {cheatAlert.type === "TAB_SWITCH" && cheatAlert.count >= 3 && (
                  <div style={{ marginTop:8, color:T.red, fontWeight:700, fontSize:12 }}>⚠ {cheatAlert.count} violations recorded — continued switching may result in exam termination.</div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {confirmSubmit && (
        <Modal title="Submit Exam?" onClose={()=>setConfirmSubmit(false)}>
          <p style={{ color:T.muted, marginBottom:24 }}>You've answered <strong style={{color:T.green}}>{ansCounts.ans}</strong> and left <strong style={{color:T.red}}>{ansCounts.na+ansCounts.nv}</strong> unanswered. Submit now?</p>
          <div style={{ display:"flex", gap:12 }}>
            <button style={{ ...css.btn(T.surface,T.muted), flex:1, padding:"12px 0" }} onClick={()=>setConfirmSubmit(false)}>Cancel</button>
            <button style={{ ...css.btn(T.red), flex:1, padding:"12px 0" }} onClick={doSubmit}>Submit Now</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   CHEAT NOTIFICATIONS PAGE  (teacher + superadmin)
═══════════════════════════════════════════════════════════ */
const CHEAT_META = {
  TAB_SWITCH:        { label:"Tab Switch",        icon:"🔀", color:"#ef4444" },
  WINDOW_BLUR:       { label:"Window Blur",        icon:"🌫️", color:"#f59e0b" },
  COPY_TEXT:         { label:"Copy Attempt",       icon:"📋", color:"#ef4444" },
  RIGHT_CLICK:       { label:"Right Click",        icon:"🖱️", color:"#f59e0b" },
  ALT_TAB:           { label:"Alt+Tab",            icon:"🚨", color:"#ef4444" },
  SCREENSHOT:        { label:"Screenshot",         icon:"📸", color:"#ef4444" },
  DEVTOOLS:          { label:"DevTools Open",      icon:"🛠️", color:"#ef4444" },
  KEYBOARD_SHORTCUT: { label:"Keyboard Shortcut",  icon:"⌨️", color:"#f59e0b" },
};
const SEV_COLOR = { high:T.red, medium:T.yellow, low:"#f97316" };

/* ═══════════════════════════════════════════════════════════
   CHEAT NOTIFICATIONS PAGE  (teacher + superadmin)
═══════════════════════════════════════════════════════════ */
function CheatNotificationsPage({ user }) {
  const [filterSev,  setFilterSev]  = useState("all");
  const [filterExam, setFilterExam] = useState("all");
  const [filterStudent, setFilterStudent] = useState("all");
  const [view, setView]             = useState("feed"); // "feed" | "students"
  const [tick, setTick]             = useState(0);
  const refresh = () => setTick(t => t + 1);

  const db = getDB();
  const myExamIds = user.role === "teacher" ? db.exams.filter(e => e.createdBy === user.id).map(e => e.id) : null;
  const myExams   = myExamIds ? db.exams.filter(e => myExamIds.includes(e.id)) : db.exams;

  // Pull logs from both cheatLogs table AND attempt.cheatSummary.logs (deduplicated by id)
  const seenIds = new Set();
  const rawLogs = [
    ...db.cheatLogs,
    ...db.attempts.flatMap(a => (a.cheatSummary?.logs||[]).map(l => ({...l, studentId:a.userId, examId:a.examId, seen:a.cheatSummary?.teacherAction?true:(l.seen||false)})))
  ].filter(l => {
    if (seenIds.has(l.id)) return false;
    seenIds.add(l.id);
    return myExamIds === null || myExamIds.includes(l.examId);
  });

  const allStudentIds = [...new Set(rawLogs.map(l => l.studentId))];
  const allLogs = rawLogs
    .filter(l => filterSev === "all" || l.severity === filterSev)
    .filter(l => filterExam === "all" || l.examId === filterExam)
    .filter(l => filterStudent === "all" || l.studentId === filterStudent)
    .sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));

  // Per-student aggregation
  const byStudent = {};
  rawLogs.forEach(l => {
    if (!byStudent[l.studentId]) byStudent[l.studentId] = { total:0, high:0, medium:0, byType:{} };
    byStudent[l.studentId].total++;
    if (l.severity === "high") byStudent[l.studentId].high++;
    if (l.severity === "medium") byStudent[l.studentId].medium++;
    byStudent[l.studentId].byType[l.type] = (byStudent[l.studentId].byType[l.type]||0)+1;
  });

  const unseenCount = rawLogs.filter(l => !l.seen).length;
  const markAllSeen = () => {
    runtimeDB.cheatLogs.forEach(l => { if (myExamIds===null||myExamIds.includes(l.examId)) l.seen = true; });
    refresh();
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
        <div>
          <h2 style={{ color:T.text, fontSize:22, fontWeight:800, margin:"0 0 4px" }}>
            🚨 Cheat Notifications
            {unseenCount > 0 && <span style={{ marginLeft:10, background:T.red, color:"#fff", fontSize:12, fontWeight:800, borderRadius:20, padding:"3px 12px" }}>{unseenCount} new</span>}
          </h2>
          <p style={{ color:T.muted, margin:0, fontSize:13 }}>Live alerts when students switch tabs, copy text, open DevTools, or use AI shortcuts during exams.</p>
        </div>
        {unseenCount > 0 && (
          <button style={{ ...css.btn(T.surface, T.muted), fontSize:13 }} onClick={markAllSeen}>Mark all seen</button>
        )}
      </div>

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, margin:"20px 0 24px" }}>
        {[
          { label:"Total Incidents",   value:rawLogs.length,                                 icon:"📊", color:T.accent  },
          { label:"High Severity",     value:rawLogs.filter(l=>l.severity==="high").length,  icon:"🚨", color:T.red     },
          { label:"Students Flagged",  value:Object.keys(byStudent).length,                  icon:"👤", color:T.yellow  },
          { label:"Exams Affected",    value:[...new Set(rawLogs.map(l=>l.examId))].length,  icon:"📋", color:T.purple  },
        ].map(s => (
          <div key={s.label} style={{ ...css.card(), display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ width:44, height:44, borderRadius:12, background:s.color+"22", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>{s.icon}</div>
            <div>
              <div style={{ color:T.text, fontSize:24, fontWeight:800 }}>{s.value}</div>
              <div style={{ color:T.muted, fontSize:12 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* View toggle + Filters */}
      <div style={{ display:"flex", gap:10, marginBottom:20, flexWrap:"wrap", alignItems:"center" }}>
        {/* View toggle */}
        <div style={{ display:"flex", background:T.surface, borderRadius:10, padding:3 }}>
          {[["feed","📋 Feed"],["students","👤 By Student"]].map(([v,l]) => (
            <button key={v} onClick={() => setView(v)} style={{ padding:"7px 16px", borderRadius:8, background:view===v?T.accent:"transparent", border:"none", color:view===v?"#fff":T.muted, fontWeight:view===v?700:500, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>{l}</button>
          ))}
        </div>
        {/* Severity filter */}
        <div style={{ display:"flex", background:T.surface, borderRadius:10, padding:3 }}>
          {["all","high","medium","low"].map(f => (
            <button key={f} onClick={() => setFilterSev(f)} style={{ padding:"7px 14px", borderRadius:8, background:filterSev===f?T.accent:"transparent", border:"none", color:filterSev===f?"#fff":T.muted, fontWeight:filterSev===f?700:500, fontSize:13, cursor:"pointer", fontFamily:"inherit", textTransform:"capitalize" }}>{f}</button>
          ))}
        </div>
        {/* Exam filter */}
        <select style={{ ...css.input, width:"auto", fontSize:13 }} value={filterExam} onChange={e=>setFilterExam(e.target.value)}>
          <option value="all">All Exams</option>
          {myExams.map(ex => <option key={ex.id} value={ex.id}>{ex.title}</option>)}
        </select>
        {/* Student filter */}
        <select style={{ ...css.input, width:"auto", fontSize:13 }} value={filterStudent} onChange={e=>setFilterStudent(e.target.value)}>
          <option value="all">All Students</option>
          {allStudentIds.map(sid => { const s=db.users.find(u=>u.id===sid); return <option key={sid} value={sid}>{s?.name||sid}</option>; })}
        </select>
      </div>

      {/* ── FEED VIEW ── */}
      {view === "feed" && (
        allLogs.length === 0 ? (
          <div style={{ ...css.card(), textAlign:"center", padding:56 }}>
            <div style={{ fontSize:52, marginBottom:12 }}>✅</div>
            <div style={{ color:T.green, fontWeight:700, fontSize:18 }}>No incidents detected</div>
            <div style={{ color:T.muted, fontSize:13, marginTop:6 }}>All students behaved properly during their exams.</div>
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {allLogs.map(log => {
              const student = db.users.find(u => u.id === log.studentId);
              const exam    = db.exams.find(e => e.id === log.examId);
              const meta    = CHEAT_META[log.type] || { label:log.type, icon:"⚠️", color:T.yellow };
              const sc      = SEV_COLOR[log.severity] || T.muted;
              return (
                <div key={log.id} style={{ ...css.card({padding:"14px 20px"}), display:"flex", gap:14, alignItems:"center", borderLeft:`4px solid ${meta.color}`, opacity:log.seen?.7:1, transition:"opacity .2s" }}>
                  <div style={{ width:44, height:44, borderRadius:12, background:meta.color+"22", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0 }}>{meta.icon}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3, flexWrap:"wrap" }}>
                      <span style={{ color:T.text, fontWeight:700 }}>{meta.label}</span>
                      <span style={{ background:sc+"22", color:sc, fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:20, textTransform:"uppercase" }}>{log.severity}</span>
                      {!log.seen && <span style={{ background:T.red, color:"#fff", fontSize:10, fontWeight:800, padding:"2px 8px", borderRadius:20 }}>NEW</span>}
                    </div>
                    <div style={{ color:T.muted, fontSize:13 }}>
                      <strong style={{ color:T.text }}>{student?.name||"Unknown"}</strong> · {exam?.title||"Unknown exam"}
                    </div>
                    <div style={{ color:T.muted, fontSize:12, marginTop:2 }}>{log.detail}</div>
                  </div>
                  <div style={{ textAlign:"right", flexShrink:0 }}>
                    <div style={{ color:T.muted, fontSize:12 }}>{new Date(log.timestamp).toLocaleTimeString()}</div>
                    <div style={{ color:T.muted, fontSize:11 }}>{new Date(log.timestamp).toLocaleDateString()}</div>
                    {!log.seen && (
                      <button style={{ ...css.btn(T.surface,T.muted), padding:"4px 10px", fontSize:11, marginTop:6 }}
                        onClick={() => {
                          const i = runtimeDB.cheatLogs.findIndex(l => l.id===log.id);
                          if (i>=0) runtimeDB.cheatLogs[i].seen = true;
                          refresh();
                        }}>Dismiss</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* ── STUDENT RISK VIEW ── */}
      {view === "students" && (
        Object.keys(byStudent).length === 0 ? (
          <div style={{ ...css.card(), textAlign:"center", padding:56 }}>
            <div style={{ fontSize:52, marginBottom:12 }}>✅</div>
            <div style={{ color:T.green, fontWeight:700, fontSize:18 }}>No students flagged</div>
          </div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))", gap:16 }}>
            {Object.entries(byStudent)
              .sort(([,a],[,b]) => b.high - a.high || b.total - a.total)
              .map(([stuId, data]) => {
                const student  = db.users.find(u => u.id === stuId);
                const risk     = data.high >= 3 ? "HIGH RISK" : data.high >= 1 ? "SUSPICIOUS" : "LOW RISK";
                const riskCol  = data.high >= 3 ? T.red : data.high >= 1 ? T.yellow : "#f97316";
                const attempts = db.attempts.filter(a => a.userId===stuId && (myExamIds===null||myExamIds.includes(a.examId)));
                return (
                  <div key={stuId} style={{ ...css.card({padding:"18px 20px"}), borderTop:`3px solid ${riskCol}` }}>
                    <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14 }}>
                      <Avatar initials={student?.avatar||"?"} size={42} color={riskCol} />
                      <div style={{ flex:1 }}>
                        <div style={{ color:T.text, fontWeight:700, fontSize:15 }}>{student?.name||"Unknown"}</div>
                        <div style={{ color:T.muted, fontSize:12 }}>{student?.email}</div>
                      </div>
                      <Badge color={riskCol}>{risk}</Badge>
                    </div>
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:14 }}>
                      <div style={{ background:T.surface, borderRadius:8, padding:"8px 10px", textAlign:"center" }}>
                        <div style={{ color:T.text, fontWeight:800, fontSize:20 }}>{data.total}</div>
                        <div style={{ color:T.muted, fontSize:10 }}>Total</div>
                      </div>
                      <div style={{ background:T.red+"15", borderRadius:8, padding:"8px 10px", textAlign:"center" }}>
                        <div style={{ color:T.red, fontWeight:800, fontSize:20 }}>{data.high}</div>
                        <div style={{ color:T.muted, fontSize:10 }}>High</div>
                      </div>
                      <div style={{ background:T.yellow+"15", borderRadius:8, padding:"8px 10px", textAlign:"center" }}>
                        <div style={{ color:T.yellow, fontWeight:800, fontSize:20 }}>{data.medium}</div>
                        <div style={{ color:T.muted, fontSize:10 }}>Medium</div>
                      </div>
                    </div>
                    {/* Type breakdown */}
                    <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:12 }}>
                      {Object.entries(data.byType).map(([type, count]) => {
                        const m = CHEAT_META[type] || { icon:"⚠️", label:type };
                        return (
                          <div key={type} style={{ background:T.surface, borderRadius:8, padding:"4px 10px", display:"flex", alignItems:"center", gap:5, fontSize:12 }}>
                            <span>{m.icon}</span><span style={{ color:T.muted }}>{m.label}</span><span style={{ color:T.text, fontWeight:700 }}>×{count}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ color:T.muted, fontSize:12 }}>Exams taken: {attempts.length} · Flagged: {attempts.filter(a=>a.cheatSummary?.flagged).length}</div>
                  </div>
                );
              })}
          </div>
        )
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ANALYTICS PAGE  (teacher + superadmin)
═══════════════════════════════════════════════════════════ */
function AnalyticsPage({ user }) {
  const db          = getDB();
  const isAdmin     = user.role === "superadmin";
  const myExamIds   = isAdmin ? db.exams.map(e=>e.id) : db.exams.filter(e=>e.createdBy===user.id).map(e=>e.id);
  const myAttempts  = db.attempts.filter(a => myExamIds.includes(a.examId));
  const myExams     = db.exams.filter(e => myExamIds.includes(e.id));
  const myClasses   = isAdmin ? db.classes : db.classes.filter(c=>c.teacherId===user.id);
  const myStudents  = db.users.filter(u => u.role==="student" && myClasses.some(c=>(u.classIds||[]).includes(c.id)));

  const avgScore    = myAttempts.length ? (myAttempts.reduce((s,a)=>s+(a.score/a.total)*100,0)/myAttempts.length).toFixed(1) : 0;
  const passRate    = myAttempts.length ? (myAttempts.filter(a=>{ const ex=db.exams.find(e=>e.id===a.examId); return a.score>=(ex?.passingMarks||0); }).length/myAttempts.length*100).toFixed(0) : 0;
  const flaggedCount= myAttempts.filter(a=>a.cheatSummary?.flagged).length;

  // Per-exam stats
  const examStats = myExams.map(ex => {
    const atts  = myAttempts.filter(a=>a.examId===ex.id);
    const avg   = atts.length ? (atts.reduce((s,a)=>s+(a.score/a.total)*100,0)/atts.length).toFixed(0) : 0;
    const pass  = atts.length ? atts.filter(a=>a.score>=ex.passingMarks).length : 0;
    return { ...ex, attempts:atts.length, avg, pass, passRate: atts.length ? (pass/atts.length*100).toFixed(0) : 0 };
  }).sort((a,b)=>b.attempts-a.attempts);

  // Per-question difficulty (questions with most wrong answers)
  const questionStats = db.questions.filter(q=>myExamIds.includes(q.examId)).map(q => {
    const atts   = myAttempts.filter(a=>a.examId===q.examId && a.answers[q.id]!==undefined);
    const wrong  = atts.filter(a=>a.answers[q.id]!==q.correct).length;
    const total  = myAttempts.filter(a=>a.examId===q.examId).length;
    const pctWrong = total ? Math.round(wrong/total*100) : 0;
    return { ...q, wrong, total, pctWrong };
  }).sort((a,b)=>b.pctWrong-a.pctWrong).slice(0,8);

  // Score distribution buckets for bar chart
  const buckets  = [0,10,20,30,40,50,60,70,80,90].map(lo => ({
    label:`${lo}-${lo+9}%`,
    count: myAttempts.filter(a=>{ const pct=(a.score/a.total)*100; return pct>=lo && pct<lo+10; }).length
  }));
  const maxBucket = Math.max(1,...buckets.map(b=>b.count));

  // Student performance table
  const studentPerf = myStudents.map(s => {
    const atts  = myAttempts.filter(a=>a.userId===s.id);
    const avg   = atts.length ? (atts.reduce((s,a)=>s+(a.score/a.total)*100,0)/atts.length).toFixed(0) : null;
    const pass  = atts.filter(a=>{ const ex=db.exams.find(e=>e.id===a.examId); return a.score>=(ex?.passingMarks||0); }).length;
    return { ...s, exams:atts.length, avg, pass };
  }).sort((a,b)=>(+b.avg||0)-(+a.avg||0));

  return (
    <div>
      <h2 style={{ color:T.text, fontSize:22, fontWeight:800, margin:"0 0 4px" }}>📈 Analytics</h2>
      <p style={{ color:T.muted, margin:"0 0 24px", fontSize:13 }}>Platform-wide performance insights and exam difficulty analysis.</p>

      {/* KPI row */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:24 }} className="stats-grid">
        {[
          { label:"Total Attempts", value:myAttempts.length, icon:"✍️", color:T.accent  },
          { label:"Avg Score",      value:avgScore+"%",       icon:"📊", color:T.yellow  },
          { label:"Pass Rate",      value:passRate+"%",       icon:"✅", color:T.green   },
          { label:"Flagged",        value:flaggedCount,       icon:"🚨", color:T.red     },
        ].map(s => (
          <div key={s.label} style={{ ...css.card(), display:"flex", alignItems:"center", gap:14 }}>
            <div style={{ width:44,height:44,borderRadius:12,background:s.color+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20 }}>{s.icon}</div>
            <div><div style={{ color:T.text, fontSize:24, fontWeight:800 }}>{s.value}</div><div style={{ color:T.muted, fontSize:12 }}>{s.label}</div></div>
          </div>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20, marginBottom:20 }}>
        {/* Score distribution */}
        <div style={css.card()}>
          <h3 style={{ color:T.text, fontSize:15, fontWeight:700, margin:"0 0 16px" }}>Score Distribution</h3>
          {myAttempts.length === 0 ? <div style={{ color:T.muted, fontSize:13 }}>No attempts yet</div> : (
            <div style={{ display:"flex", alignItems:"flex-end", gap:6, height:120 }}>
              {buckets.map(b => (
                <div key={b.label} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                  <div style={{ fontSize:10, color:T.muted }}>{b.count||""}</div>
                  <div style={{ width:"100%", borderRadius:4, background: b.count>0?T.accent:T.surface, height:Math.max(4,(b.count/maxBucket)*90), transition:"height .4s" }} />
                  <div style={{ fontSize:9, color:T.muted, textAlign:"center", lineHeight:1.2 }}>{b.label.split("-")[0]}%</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Per-exam performance */}
        <div style={css.card()}>
          <h3 style={{ color:T.text, fontSize:15, fontWeight:700, margin:"0 0 16px" }}>Exam Performance</h3>
          {examStats.length === 0 ? <div style={{ color:T.muted, fontSize:13 }}>No exams yet</div> : (
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {examStats.slice(0,5).map(ex => (
                <div key={ex.id} style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ color:T.text, fontSize:12, fontWeight:600, marginBottom:3, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{ex.title}</div>
                    <div style={{ height:6, background:T.surface, borderRadius:3 }}>
                      <div style={{ width:ex.avg+"%", height:"100%", background:ex.avg>=50?T.green:T.red, borderRadius:3, transition:"width .4s" }} />
                    </div>
                  </div>
                  <div style={{ textAlign:"right", flexShrink:0 }}>
                    <div style={{ color:T.text, fontSize:12, fontWeight:700 }}>{ex.avg}%</div>
                    <div style={{ color:T.muted, fontSize:10 }}>{ex.attempts} tries</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Hardest questions */}
      <div style={{ ...css.card(), marginBottom:20 }}>
        <h3 style={{ color:T.text, fontSize:15, fontWeight:700, margin:"0 0 16px" }}>🔥 Hardest Questions (most wrong answers)</h3>
        {questionStats.length === 0 ? <div style={{ color:T.muted, fontSize:13 }}>No attempt data yet</div> : (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {questionStats.map((q,i) => (
              <div key={q.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"8px 0", borderBottom:`1px solid ${T.cardBorder}` }}>
                <div style={{ width:28,height:28,borderRadius:8,background:q.pctWrong>=70?T.red+"22":T.yellow+"22",display:"flex",alignItems:"center",justifyContent:"center",color:q.pctWrong>=70?T.red:T.yellow,fontWeight:800,fontSize:12,flexShrink:0 }}>{i+1}</div>
                <div style={{ flex:1 }}>
                  <div style={{ color:T.text, fontSize:13, marginBottom:2 }}>{q.text?.slice(0,80)||"Image question"}{q.text?.length>80?"…":""}</div>
                  <div style={{ color:T.muted, fontSize:11 }}>{q.subject} · {q.difficulty}</div>
                </div>
                <div style={{ textAlign:"right", flexShrink:0 }}>
                  <div style={{ color:q.pctWrong>=70?T.red:T.yellow, fontWeight:800, fontSize:15 }}>{q.pctWrong}%</div>
                  <div style={{ color:T.muted, fontSize:10 }}>wrong</div>
                </div>
                <div style={{ width:60 }}>
                  <div style={{ height:6, background:T.surface, borderRadius:3 }}>
                    <div style={{ width:q.pctWrong+"%", height:"100%", background:q.pctWrong>=70?T.red:T.yellow, borderRadius:3 }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Student performance table */}
      <div style={css.card()}>
        <h3 style={{ color:T.text, fontSize:15, fontWeight:700, margin:"0 0 16px" }}>👥 Student Performance</h3>
        {studentPerf.length === 0 ? <div style={{ color:T.muted, fontSize:13 }}>No students yet</div> : (
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
              <thead>
                <tr style={{ borderBottom:`1px solid ${T.cardBorder}` }}>
                  {["#","Student","Exams","Avg Score","Passed","Risk"].map(h => (
                    <th key={h} style={{ color:T.muted, fontWeight:600, padding:"6px 12px", textAlign:"left", fontSize:11, textTransform:"uppercase", letterSpacing:.5 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {studentPerf.map((s,i) => {
                  const cheatCount = myAttempts.filter(a=>a.userId===s.id&&(a.cheatSummary?.total||0)>0).length;
                  const risk       = cheatCount>=3?"High":cheatCount>=1?"Med":"Clean";
                  const riskCol    = cheatCount>=3?T.red:cheatCount>=1?T.yellow:T.green;
                  return (
                    <tr key={s.id} style={{ borderBottom:`1px solid ${T.cardBorder}` }}>
                      <td style={{ padding:"10px 12px", color:T.muted }}>{i+1}</td>
                      <td style={{ padding:"10px 12px" }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          <Avatar initials={s.avatar} size={28} color={T.accent} />
                          <div><div style={{ color:T.text, fontWeight:600 }}>{s.name}</div><div style={{ color:T.muted, fontSize:11 }}>{s.email}</div></div>
                        </div>
                      </td>
                      <td style={{ padding:"10px 12px", color:T.text }}>{s.exams}</td>
                      <td style={{ padding:"10px 12px" }}>
                        {s.avg !== null ? (
                          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                            <div style={{ flex:1, height:6, background:T.surface, borderRadius:3, minWidth:60 }}>
                              <div style={{ width:s.avg+"%", height:"100%", background:+s.avg>=60?T.green:T.red, borderRadius:3 }} />
                            </div>
                            <span style={{ color:+s.avg>=60?T.green:T.red, fontWeight:700, minWidth:32 }}>{s.avg}%</span>
                          </div>
                        ) : <span style={{ color:T.muted }}>—</span>}
                      </td>
                      <td style={{ padding:"10px 12px", color:T.text }}>{s.pass}</td>
                      <td style={{ padding:"10px 12px" }}><Badge color={riskCol}>{risk}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ANNOUNCEMENTS PAGE  (teacher creates; students read)
═══════════════════════════════════════════════════════════ */
function AnnouncementsPage({ user }) {
  const [form, setForm]       = useState({ classId:"", title:"", body:"", expiresAt:"" });
  const [showModal, setShowModal] = useState(false);
  const [tick, setTick]       = useState(0);
  const refresh = () => setTick(t=>t+1);
  const db = getDB();

  const isTeacher = user.role === "teacher" || user.role === "superadmin";
  const myClasses = isTeacher ? db.classes.filter(c=>c.teacherId===user.id) : [];
  const announcements = db.announcements.filter(a => {
    if (user.role === "student") return (user.classIds||[]).includes(a.classId);
    if (user.role === "teacher") return myClasses.some(c=>c.id===a.classId);
    return true;
  }).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));

  const post = () => {
    if (!form.title.trim()||!form.body.trim()||!form.classId) return;
    const ann = { id:uid(), ...form, teacherId:user.id, createdAt:new Date().toISOString() };
    runtimeDB.announcements.push(ann);
    // Notify enrolled students
    db.users.filter(u=>u.role==="student"&&(u.classIds||[]).includes(form.classId)).forEach(s => {
      pushNotif(s.id, "announce", "New announcement", form.title, "dashboard");
    });
    setForm({classId:"",title:"",body:"",expiresAt:""}); setShowModal(false); refresh();
  };

  const del = (id) => { runtimeDB.announcements = runtimeDB.announcements.filter(a=>a.id!==id); refresh(); };

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
        <div>
          <h2 style={{ color:T.text, fontSize:22, fontWeight:800, margin:"0 0 4px" }}>📢 Announcements</h2>
          <p style={{ color:T.muted, margin:0, fontSize:13 }}>{isTeacher?"Post updates to your classes.":"Latest updates from your teachers."}</p>
        </div>
        {isTeacher && myClasses.length>0 && (
          <button style={css.btn("linear-gradient(135deg,#6366f1,#a855f7)")} onClick={()=>setShowModal(true)}>+ New Announcement</button>
        )}
      </div>

      {announcements.length === 0 ? (
        <div style={{ ...css.card({textAlign:"center",padding:56}) }}>
          <div style={{ fontSize:48, marginBottom:12 }}>📢</div>
          <div style={{ color:T.muted }}>No announcements yet.</div>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          {announcements.map(ann => {
            const cls      = db.classes.find(c=>c.id===ann.classId);
            const teacher  = db.users.find(u=>u.id===ann.teacherId);
            const expired  = ann.expiresAt && new Date(ann.expiresAt) < new Date();
            return (
              <div key={ann.id} style={{ ...css.card(), borderLeft:`4px solid ${expired?T.muted:T.accent}`, opacity:expired?.7:1 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6, flexWrap:"wrap" }}>
                      <Badge color={T.accent}>{cls?.name||"Unknown class"}</Badge>
                      {expired && <Badge color={T.muted}>Expired</Badge>}
                    </div>
                    <h3 style={{ color:T.text, fontWeight:700, fontSize:16, margin:"0 0 8px" }}>{ann.title}</h3>
                    <p style={{ color:T.muted, fontSize:14, margin:"0 0 10px", lineHeight:1.6 }}>{ann.body}</p>
                    <div style={{ color:T.muted, fontSize:12 }}>
                      {teacher?.name} · {new Date(ann.createdAt).toLocaleDateString()}
                      {ann.expiresAt && ` · Expires ${new Date(ann.expiresAt).toLocaleDateString()}`}
                    </div>
                  </div>
                  {isTeacher && ann.teacherId===user.id && (
                    <button style={{ ...css.btn(T.red+"22",T.red), padding:"5px 12px", fontSize:12, flexShrink:0 }} onClick={()=>del(ann.id)}>Delete</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <Modal title="New Announcement" onClose={()=>setShowModal(false)}>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div><label style={css.label}>Class</label>
              <select style={css.input} value={form.classId} onChange={e=>setForm(p=>({...p,classId:e.target.value}))}>
                <option value="">— Select class —</option>
                {myClasses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div><label style={css.label}>Title</label><input style={css.input} value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))} placeholder="e.g. Results Published!" /></div>
            <div><label style={css.label}>Message</label><textarea style={{...css.input,height:100,resize:"vertical"}} value={form.body} onChange={e=>setForm(p=>({...p,body:e.target.value}))} placeholder="Write your announcement here…" /></div>
            <div><label style={css.label}>Expires at <span style={{fontWeight:400,color:T.muted}}>(optional)</span></label><input style={css.input} type="datetime-local" value={form.expiresAt} onChange={e=>setForm(p=>({...p,expiresAt:e.target.value}))} /></div>
            <button style={{ ...css.btn("linear-gradient(135deg,#6366f1,#a855f7)"), padding:"12px 0", fontSize:15, opacity:(!form.title||!form.body||!form.classId)?.5:1 }} onClick={post} disabled={!form.title||!form.body||!form.classId}>Post Announcement</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   LEADERBOARD PAGE  (student view)
═══════════════════════════════════════════════════════════ */
function LeaderboardPage({ user }) {
  const db          = getDB();
  const [selClass, setSelClass] = useState((user.classIds||[])[0]||"");
  const myClassIds  = user.classIds || [];
  const myClasses   = db.classes.filter(c => myClassIds.includes(c.id));

  const classStudents = selClass ? db.users.filter(u => u.role==="student" && (u.classIds||[]).includes(selClass)) : [];
  const classExams    = selClass ? db.exams.filter(e => e.classId===selClass && e.status==="active") : [];

  const leaderboard = classStudents.map(s => {
    const atts  = db.attempts.filter(a => a.userId===s.id && classExams.some(e=>e.id===a.examId));
    const avg   = atts.length ? (atts.reduce((t,a)=>t+(a.score/a.total)*100,0)/atts.length) : 0;
    const best  = atts.length ? Math.max(...atts.map(a=>(a.score/a.total)*100)) : 0;
    const pass  = atts.filter(a=>{ const ex=db.exams.find(e=>e.id===a.examId); return a.score>=(ex?.passingMarks||0); }).length;
    return { ...s, avg:+avg.toFixed(1), best:+best.toFixed(1), exams:atts.length, pass };
  }).sort((a,b) => b.avg - a.avg || b.best - a.best);

  const medals = ["🥇","🥈","🥉"];
  const cls    = db.classes.find(c=>c.id===selClass);
  const teacher= cls ? db.users.find(u=>u.id===cls.teacherId) : null;

  return (
    <div>
      <h2 style={{ color:T.text, fontSize:22, fontWeight:800, margin:"0 0 4px" }}>🏆 Class Leaderboard</h2>
      <p style={{ color:T.muted, margin:"0 0 20px", fontSize:13 }}>Ranked by average score across all exams in the class.</p>

      {myClasses.length === 0 ? (
        <div style={{ ...css.card({textAlign:"center",padding:56}) }}>
          <div style={{ fontSize:48, marginBottom:12 }}>🏆</div>
          <div style={{ color:T.muted }}>Join a class to see the leaderboard.</div>
        </div>
      ) : (
        <>
          {/* Class selector */}
          {myClasses.length > 1 && (
            <div style={{ display:"flex", gap:8, marginBottom:20, flexWrap:"wrap" }}>
              {myClasses.map(c => (
                <button key={c.id} onClick={()=>setSelClass(c.id)}
                  style={{ ...css.btn(selClass===c.id?"linear-gradient(135deg,#6366f1,#a855f7)":T.surface, selClass===c.id?"#fff":T.muted), padding:"8px 18px", fontSize:13 }}>
                  {c.name}
                </button>
              ))}
            </div>
          )}

          {cls && (
            <div style={{ ...css.card({padding:"12px 18px",marginBottom:20}), display:"flex", alignItems:"center", gap:12 }}>
              <span style={{ fontSize:22 }}>🏫</span>
              <div><div style={{ color:T.text, fontWeight:700 }}>{cls.name}</div><div style={{ color:T.muted, fontSize:12 }}>Teacher: {teacher?.name} · {classExams.length} exams</div></div>
            </div>
          )}

          {leaderboard.length === 0 ? (
            <div style={{ ...css.card({textAlign:"center",padding:40}) }}>
              <div style={{ color:T.muted, fontSize:13 }}>No students have attempted exams in this class yet.</div>
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {leaderboard.map((s,i) => {
                const isMe   = s.id === user.id;
                const medal  = medals[i] || "";
                const topPct = leaderboard.length > 1 ? Math.round((leaderboard.length-1-i)/(leaderboard.length-1)*100) : 100;
                return (
                  <div key={s.id} style={{ ...css.card({padding:"14px 20px"}), border:isMe?`2px solid ${T.accent}`:undefined, display:"flex", alignItems:"center", gap:16 }}>
                    <div style={{ width:36, height:36, borderRadius:10, background:i<3?T.accent+"22":T.surface, display:"flex", alignItems:"center", justifyContent:"center", fontSize:i<3?22:14, fontWeight:800, color:T.muted, flexShrink:0 }}>
                      {medal||`#${i+1}`}
                    </div>
                    <Avatar initials={s.avatar} size={38} color={isMe?T.accent:T.accentB} />
                    <div style={{ flex:1 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <span style={{ color:T.text, fontWeight:700 }}>{s.name}</span>
                        {isMe && <Badge color={T.accent}>You</Badge>}
                      </div>
                      <div style={{ color:T.muted, fontSize:12, marginTop:2 }}>{s.exams} exam{s.exams!==1?"s":""} attempted · {s.pass} passed</div>
                      <div style={{ marginTop:6, height:5, background:T.surface, borderRadius:3, maxWidth:200 }}>
                        <div style={{ width:s.avg+"%", height:"100%", background:s.avg>=60?T.green:T.red, borderRadius:3, transition:"width .4s" }} />
                      </div>
                    </div>
                    <div style={{ textAlign:"right", flexShrink:0 }}>
                      <div style={{ color:T.text, fontWeight:800, fontSize:20 }}>{s.avg}%</div>
                      <div style={{ color:T.muted, fontSize:11 }}>avg · top {topPct}%</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ROOT APP
═══════════════════════════════════════════════════════════ */
function App() {
  const [user, setUser]         = useState(null);
  const [page, setPage]         = useState("dashboard");
  const [activeExam, setActiveExam] = useState(null);

  const handleLogin      = (u) => { setUser(u); setPage("dashboard"); };
  const handleLogout     = () => { setUser(null); setActiveExam(null); setPage("dashboard"); };
  const handleStartExam  = (exam) => setActiveExam(exam);
  const handleFinishExam = () => { setActiveExam(null); setPage("results"); };
  const handleUserUpdated = (updated) => setUser(updated);

  if (!user) return <AuthScreen onLogin={handleLogin} />;
  if (activeExam) return <ExamScreen exam={activeExam} user={user} onFinish={handleFinishExam} />;

  const rootStyle = { display:"flex", height:"100vh", background:T.bg, fontFamily:"'Outfit','Segoe UI',sans-serif", color:T.text, overflow:"hidden" };

  const renderPage = () => {
    /* ── SUPER ADMIN ── */
    if (user.role === "superadmin") {
      if (page === "dashboard") return <AdminDashboard user={user} />;
      if (page === "teachers")  return <TeacherManager />;
      if (page === "students")  return <StudentsManager user={user} />;
      if (page === "classes")   return <AllClassesView />;
      if (page === "results")   return <ResultsPage user={user} />;
      if (page === "cheatlogs") return <CheatNotificationsPage user={user} />;
      if (page === "analytics") return <AnalyticsPage user={user} />;
      if (page === "announce")  return <AnnouncementsPage user={user} />;
    }
    /* ── TEACHER ── */
    if (user.role === "teacher") {
      if (page === "dashboard") return <TeacherDashboard user={user} />;
      if (page === "classes")   return <TeacherClassManager user={user} />;
      if (page === "exams")     return <ExamManager user={user} />;
      if (page === "questions") return <QuestionBank user={user} />;
      if (page === "students")  return <StudentsManager user={user} />;
      if (page === "results")   return <ResultsPage user={user} />;
      if (page === "cheatlogs") return <CheatNotificationsPage user={user} />;
      if (page === "analytics") return <AnalyticsPage user={user} />;
      if (page === "announce")  return <AnnouncementsPage user={user} />;
    }
    /* ── STUDENT ── */
    if (page === "dashboard")   return <StudentDashboard user={user} onStartExam={handleStartExam} onUserUpdated={handleUserUpdated} />;
    if (page === "joinclass")   return <JoinClassPage user={user} onUserUpdated={handleUserUpdated} />;
    if (page === "exams")       return <StudentExamList user={user} onStartExam={handleStartExam} />;
    if (page === "results")     return <ResultsPage user={user} />;
    if (page === "leaderboard") return <LeaderboardPage user={user} />;
    if (page === "announce")    return <AnnouncementsPage user={user} />;
  };

  return (
    <div style={rootStyle}>
      <Sidebar user={user} page={page} setPage={setPage} onLogout={handleLogout} />
      <main style={{ flex:1, overflow:"auto", padding:32 }} className="main-content">{renderPage()}</main>
    </div>
  );
}
