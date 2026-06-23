import React, { useState, useEffect } from 'react';

const StatusBar = ({ stats }) => {
  const [time, setTime] = useState(new Date().toLocaleTimeString('en-NG', {
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  }));

  useEffect(() => {
    const t = setInterval(() => {
      setTime(new Date().toLocaleTimeString('en-NG', {
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      }));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const openNCRs       = stats?.ncrs?.open || 0;
  const overdueEq      = stats?.equipment?.overdue || 0;
  const expiredWelders = stats?.welders?.expired || 0;
  const pendingDocs    = stats?.documents?.underReview || 0;
  const catAOpen       = stats?.punch?.catA_open || 0;
  const mcBlocking     = stats?.punch?.mcBlocking || 0;

  const items = [
    { cls: openNCRs > 0 ? 't-red' : 't-signal',   txt: openNCRs > 0 ? `${openNCRs} OPEN NCR${openNCRs !== 1 ? 'S' : ''} — CORRECTIVE ACTION REQUIRED` : 'ALL NCRs CLOSED — QUALITY COMPLIANT' },
    { cls: mcBlocking > 0 ? 't-red' : 't-signal',  txt: mcBlocking > 0 ? `MC GATE BLOCKED — ${mcBlocking} CATEGORY A PUNCH ITEM${mcBlocking !== 1 ? 'S' : ''} OUTSTANDING` : 'MC GATE CLEAR — ALL CAT-A PUNCH ITEMS CLOSED' },
    { cls: catAOpen > 0 ? 't-amber' : 't-signal',  txt: catAOpen > 0 ? `PUNCH LIST: ${catAOpen} CAT-A ITEM${catAOpen !== 1 ? 'S' : ''} OPEN · ${stats?.punch?.catB_open || 0} CAT-B · COMPLETION ${stats?.punch?.completionPct || 0}%` : `PUNCH LIST: ALL CATEGORY A ITEMS CLOSED · COMPLETION ${stats?.punch?.completionPct || 0}%` },
    { cls: 't-amber',                               txt: 'HOLD POINT MONITORING ACTIVE — CHECK ITP FOR PENDING SIGN-OFFS' },
    { cls: expiredWelders > 0 ? 't-red' : 't-signal', txt: expiredWelders > 0 ? `${expiredWelders} WELDER QUALIFICATION${expiredWelders !== 1 ? 'S' : ''} EXPIRED — PRODUCTION STOP ENFORCED` : 'ALL WELDER QUALIFICATIONS VALID' },
    { cls: overdueEq > 0 ? 't-amber' : 't-signal', txt: overdueEq > 0 ? `${overdueEq} EQUIPMENT CALIBRATION${overdueEq !== 1 ? 'S' : ''} OVERDUE — CHECK EQUIPMENT REGISTER` : 'EQUIPMENT CALIBRATION UP TO DATE' },
    { cls: pendingDocs > 0 ? 't-amber' : 't-steel',txt: pendingDocs > 0 ? `${pendingDocs} DOCUMENT${pendingDocs !== 1 ? 'S' : ''} PENDING APPROVAL — REVIEW REQUIRED` : 'ALL CONTROLLED DOCUMENTS APPROVED' },
    { cls: 't-signal',                              txt: 'SYSTEM ONLINE · AUDIT LOG ACTIVE · ALL RECORDS ENCRYPTED · OFFLINE SYNC READY' },
    { cls: (stats?.inspections?.passRate || 0) >= 90 ? 't-signal' : 't-amber', txt: `INSPECTION PASS RATE: ${stats?.inspections?.passRate || 0}% — TARGET ≥90%` },
  ];

  const doubled = [...items, ...items];

  return (
    <div className="status-bar">
      <div className="status-bar-label">
        <div className="status-pulse" />
        LIVE
      </div>
      <div className="status-ticker">
        <div className="ticker-inner">
          {doubled.map((it, i) => (
            <div key={i} className={`ticker-item ${it.cls}`}>
              <div className="ticker-dot" />
              {it.txt}
            </div>
          ))}
        </div>
      </div>
      <div className="status-time">{time} WAT</div>
    </div>
  );
};

export default StatusBar;
