import { useState, useMemo, useEffect } from 'react';
import { addDays, differenceInDays, format, parse, getDay, startOfWeek, getMonth } from 'date-fns';
import confetti from 'canvas-confetti';
import summerData from './data.json';

// --- Helper Functions ---
const parseDate = (dString) => parse(dString, 'yyyy-MM-dd', new Date());

// The summer spans ~12 weeks. We start on a Sunday.
const FIRST_SUNDAY = startOfWeek(parseDate('2026-05-18'), { weekStartsOn: 0 }); // 2026-05-17
const TOTAL_WEEKS = 13;
const TOTAL_DAYS = TOTAL_WEEKS * 7;
const DAYS_ARRAY = Array.from({ length: TOTAL_DAYS }, (_, i) => addDays(FIRST_SUNDAY, i));

// Group days by week array
const WEEKS_ARRAY = [];
for (let i = 0; i < TOTAL_DAYS; i += 7) {
  WEEKS_ARRAY.push(DAYS_ARRAY.slice(i, i + 7));
}

// Colors (All camps are now the same color as requested!)
const getColorClass = (type, category, title) => {
  if (type === 'family_trip') return 'color-family_trip';
  if (title.includes('Job') || title.includes('Volunteer')) return 'color-job';
  if (title.includes('Boxing')) return 'color-weekly';
  // All other optional are camps
  return 'color-overnight'; 
};

// Map images based on ID or title
const getImagePreview = (id, title) => {
  const base = import.meta.env.BASE_URL;
  if (id === 'green-river-preserve') return `${base}images/grp.jpg`;
  if (id && id.startsWith('nasa-space-academy')) return `${base}images/space-camp.png`;
  if (id === 'torched-jewelry') return `${base}images/torched.jpg`;
  if (title.includes('Firefly')) return `${base}images/pottery.jpg`;
  if (title.includes('Tryon')) return `${base}images/tryon-art.jpg`;
  if (title.includes('AVL')) return `${base}images/avl-museum.jpg`;
  return null; // fallback
};

export default function App() {
  const [tutorialStep, setTutorialStep] = useState(0); 
  // 0: Initial Welcome
  // 1: Fixed Trips overview
  // 2: Guided picking (Camps ONLY)
  // 3: Interstitial Summary (Camps -> Weekly transition)
  // 4: DnD Weekly picker
  // 5: Recap Modal
  // 6: Final View-Only Calendar (No ghosts)
  
  const [selectedPieceId, setSelectedPieceId] = useState(null); 
  const [customWeeklies, setCustomWeeklies] = useState([]);
  const [customPromptData, setCustomPromptData] = useState(null);
  const [draggingType, setDraggingType] = useState(null);
  const [hoveredDayKey, setHoveredDayKey] = useState(null);
  const [selectedTrayType, setSelectedTrayType] = useState(null);
  const [nasaPopupActive, setNasaPopupActive] = useState(false);
  const [isWeekdayOnly, setIsWeekdayOnly] = useState(false);
  const [isZoomedOut, setIsZoomedOut] = useState(false);

  // Arcade Confetti Helper
  const fireConfetti = (particleCount = 100, spread = 70, origin = { y: 0.6 }) => {
    confetti({
      particleCount,
      spread,
      origin,
      shapes: ['square'],
      colors: ['#ff3366', '#ff9933', '#ffcc00', '#00cc66', '#00e5ff', '#3366ff', '#9933ff', '#ff33cc'],
      scalar: 1.2
    });
  };

  // Level-Up Splash
  useEffect(() => {
    if (tutorialStep > 0) {
      fireConfetti(150, 100);
      // Extra bursts for high levels
      if (tutorialStep >= 5) {
        setTimeout(() => fireConfetti(200, 120, { x: 0.2, y: 0.5 }), 200);
        setTimeout(() => fireConfetti(200, 120, { x: 0.8, y: 0.5 }), 400);
      }
    }
  }, [tutorialStep]);

  // Scroll suppression for mobile DND
  useEffect(() => {
    const handleTouchMove = (e) => {
      if (draggingType) {
        e.preventDefault();
      }
    };
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    return () => window.removeEventListener('touchmove', handleTouchMove);
  }, [draggingType]);

  // Generate all layout pieces once
  const allPieces = useMemo(() => {
    const pieces = [];
    let pId = 0;

    summerData.fixed_events.forEach((evt, idx) => {
      pieces.push({
        id: `fixed_${idx}`,
        groupId: null,
        title: evt.title,
        startDate: parseDate(evt.start),
        endDate: parseDate(evt.end),
        colorClass: getColorClass(evt.type, null, evt.title),
        isFixed: true,
        type: 'fixed',
        desc: "A pre-planned family event!",
        url: "#",
        img: null
      });
    });

    // Special Birthday Block
    pieces.push({
      id: 'fixed_bday',
      groupId: null,
      title: "NAOMI'S BIRTHDAY! 🎂",
      startDate: parseDate('2026-08-17'),
      endDate: parseDate('2026-08-17'),
      colorClass: 'color-iridescent',
      isFixed: true,
      type: 'fixed',
      desc: "Time to celebrate!!! 🎉",
      url: "#",
      img: null
    });

    summerData.optional_blocks.forEach(blk => {
      const s = blk.start ? parseDate(blk.start) : parseDate('2026-06-01');
      const length = blk.duration_days || (blk.end ? differenceInDays(parseDate(blk.end), s) + 1 : 1);
      const e = addDays(s, length - 1);
      
      let desc = blk.focus || blk.category || "A fun summer camp experience!";
      if (blk.id === 'green-river-preserve') desc = "Mountain biking, rock climbing, and lush forest outdoor adventure!";
      if (blk.title.includes('NASA')) desc = "High-tech rocket building, simulation, and astronaut training!";
      if (blk.title.includes('Art') || blk.title.includes('Firefly')) desc = "Arts, crafts, pottery, and hands-on creative making!";
      if (blk.title.includes('Torched')) desc = "Learn metal smithing and craft your own jewelry accessories.";

      pieces.push({
        id: blk.id || `opt_${pId++}`,
        groupId: null,
        title: blk.title,
        startDate: s,
        endDate: e,
        colorClass: getColorClass(null, blk.category, blk.title),
        isFixed: false,
        type: 'camp',
        desc: desc,
        url: blk.url || "#",
        img: getImagePreview(blk.id, blk.title)
      });
    });

    // We replaced the default generic predefined mapping so everything weekly
    // flows dynamically through the DND trait mapping down later.
    customWeeklies.forEach(cw => {
      const isBoxing = cw.title === 'Boxing';
      const targetDays = isBoxing ? [1, 3, 6] : [cw.dayOfWeek];
      
      DAYS_ARRAY.forEach(d => {
        if (targetDays.includes(getDay(d))) {
          pieces.push({
            id: `rec_cust_${cw.groupId}_${d.getTime()}`,
            groupId: cw.groupId,
            title: cw.title,
            startDate: d,
            endDate: d,
            colorClass: isBoxing ? 'color-weekly' : (cw.title.includes('Job') || cw.title.includes('Volunteer') ? 'color-job' : 'color-skills'), 
            isFixed: false,
            type: 'weekly',
            desc: isBoxing ? "Weekly boxing sessions every Mon, Wed, and Sat." : "Your weekly activity!",
            url: "#",
            img: null
          });
        }
      });
    });

    return pieces;
  }, [customWeeklies]);

  const initialActive = new Set(allPieces.filter(p => p.isFixed).map(p => p.id));
  const [activeIds, setActiveIds] = useState(initialActive);
  
  // Requirement counters
  const activeCamps = allPieces.filter(p => p.type === 'camp' && activeIds.has(p.id));
  const activeCampIds = new Set(activeCamps.map(p => p.id));
  const activeWeeklyGroups = new Set(allPieces.filter(p => p.type === 'weekly' && activeIds.has(p.id)).map(p => p.groupId));
  
  const hasNasa = activeCamps.some(p => p.title.includes('NASA'));
  const campsCount = activeCampIds.size;
  const weeklyCount = activeWeeklyGroups.size;
  
  const campsTarget = hasNasa ? 1 : 2;
  const meetsRequirements = campsCount >= campsTarget && weeklyCount >= 1;

  // Toggling piece
  const togglePieceActive = (piece) => {
    setActiveIds(prev => {
      const next = new Set(prev);
      const isCurrentlyActive = prev.has(piece.id);

      if (piece.type === 'camp' && !isCurrentlyActive) {
          const movingToNasa = piece.title.includes('NASA');
          const alreadyHasNasa = activeCamps.some(p => p.title.includes('NASA'));
          
          if (movingToNasa && activeCamps.length > 0) {
              alert("Wait! If you pick NASA Space Academy, it'll be the only camp for the summer. Please remove your other camps first!");
              return prev;
          }
          if (alreadyHasNasa) {
              alert("You've already picked NASA Space Academy! If you want to pick this camp, you'll need to remove NASA first.");
              return prev;
          }

          if (movingToNasa) {
              setNasaPopupActive(true);
          }
      }

      if (piece.groupId) {
        const groupPieces = allPieces.filter(p => p.groupId === piece.groupId);
        groupPieces.forEach(p => {
          if (isCurrentlyActive) next.delete(p.id);
          else next.add(p.id);
        });
      } else {
        if (isCurrentlyActive) next.delete(piece.id);
        else next.add(piece.id);
      }
      return next;
    });
    setSelectedPieceId(null);
  };

  const handleBlockClick = (e, piece) => {
    e.stopPropagation();
    if (piece.isFixed || tutorialStep >= 5) return;
    if (tutorialStep === 4 && piece.type === 'camp') return; // let them focus on drop in step 4
    if (selectedPieceId === piece.id) {
        setSelectedPieceId(null); // click again to close
    } else {
        setSelectedPieceId(piece.id);
    }
  };

  const handleDrop = (e, droppedDate) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('type');
    if (!type) return;

    const dayOfWeek = getDay(droppedDate);

    if (['boxing', 'job', 'volunteer'].includes(type)) {
      let title = 'Weekly Activity';
      if (type === 'boxing') title = 'Boxing';
      if (type === 'job') title = 'Summer Job';
      if (type === 'volunteer') title = 'Volunteer';
      
      commitWeeklyActivity(title, dayOfWeek);
      fireConfetti(40, 50, { y: 0.8 }); // Drop splash
    } else if (type === 'custom') {
       setCustomPromptData({ dayOfWeek });
    }
  };

  const commitWeeklyActivity = (title, dayOfWeek) => {
       const groupId = `custom_${Date.now()}`;
       setCustomWeeklies(prev => [...prev, { groupId, title, dayOfWeek }]);
       fireConfetti(60, 60, { y: 0.7 }); // Bigger splash for custom committed
       
       const newIds = [];
       DAYS_ARRAY.forEach(d => {
         if (getDay(d) === dayOfWeek) newIds.push(`rec_cust_${groupId}_${d.getTime()}`);
       });
       
       setActiveIds(prev => {
         const next = new Set(prev);
         newIds.forEach(id => next.add(id));
         return next;
       });
  };

  // Rendering a block within a week
  const renderBlockForWeek = (weekDays, piece, indexInLane) => {
    const daysInView = weekDays.length;
    const weekStart = weekDays[0];
    const weekEnd = weekDays[daysInView - 1];

    if (piece.endDate < weekStart || piece.startDate > weekEnd) return null;

    const isActive = activeIds.has(piece.id);

    // Filters for tutorial steps
    if (tutorialStep === 1 && !piece.isFixed) return null; 
    if (tutorialStep === 2 && piece.type === 'weekly') return null; 
    if (tutorialStep === 3 && piece.type === 'weekly') return null; 
    if (tutorialStep === 4 && piece.type === 'weekly' && !isActive) return null; 
    if (tutorialStep >= 4 && piece.type === 'camp' && !isActive) return null; 
    if (tutorialStep >= 5 && !isActive && !piece.isFixed) return null; 
    if (tutorialStep === 6 && !isActive && !piece.isFixed) return null; 

    const startForCalc = piece.startDate < weekStart ? weekStart : piece.startDate;
    const endForCalc = piece.endDate > weekEnd ? weekEnd : piece.endDate;

    const startOffset = differenceInDays(startForCalc, weekStart);
    const endOffset = differenceInDays(endForCalc, weekStart);
    const lengthInView = endOffset - startOffset + 1;

    const statusClass = isActive ? 'status-active' : 'status-inactive';

    const leftPercent = (startOffset / daysInView) * 100;
    const widthPercent = (lengthInView / daysInView) * 100;
    
    // Step 2 Guidance
    const showCampGuidance = (tutorialStep === 2 && campsCount < 2 && piece.type === 'camp' && !isActive);
    
    // Step 1 Guidance
    const showFixedGuidance = (tutorialStep === 1 && piece.id === 'fixed_0');

    return (
      <div key={`${piece.id}_${weekStart.getTime()}`} style={{ position: 'relative' }}>
         {showFixedGuidance && (
            <div className="tooltip-point" style={{ background: 'var(--block-orange)' }}>
              Here are the trips we already have planned! ⬇️
            </div>
         )}
        <div
          className={`tetromino-block ${piece.colorClass} ${statusClass} ${showCampGuidance ? 'shimmer-glow' : ''}`}
          onClick={(e) => handleBlockClick(e, piece)}
          style={{
            left: `${leftPercent}%`,
            width: `${widthPercent}%`,
            top: `${10 + indexInLane * 50}px` 
          }}
        >
          <div className="tetromino-text">{piece.title}</div>

          {selectedPieceId === piece.id && !piece.isFixed && (
            <div className="click-tooltip" onClick={(e) => e.stopPropagation()}>
              <h4>{piece.title}</h4>
              {piece.img && <img src={piece.img} alt={piece.title} />}
              <p>{piece.desc}</p>
              {piece.url !== '#' && <a href={piece.url} target="_blank" rel="noreferrer">Visit Website</a>}
              <button onClick={() => togglePieceActive(piece)}>
                 {isActive ? "Remove from Schedule" : "Add to Schedule!"}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Month colors mapper
  const getMonthConfig = (weekStart) => {
    const m = getMonth(weekStart); // 4=May, 5=Jun, 6=Jul, 7=Aug
    if (m === 4) return { name: 'MAY', color: 'rgba(0, 229, 255, 0.05)' };
    if (m === 5) return { name: 'JUN', color: 'rgba(255, 51, 102, 0.05)' };
    if (m === 6) return { name: 'JUL', color: 'rgba(255, 153, 51, 0.05)' };
    return { name: 'AUG', color: 'rgba(51, 204, 102, 0.05)' };
  };

  return (
    <div className={`app-container ${draggingType ? 'is-dragging' : ''}`} onClick={() => setSelectedPieceId(null)}>
      {/* 0. Welcome Modal */}
      {tutorialStep === 0 && (
        <div className="tutorial-overlay">
          <div className="tutorial-modal">
            <h2>Welcome to Naomi's Summer!</h2>
            <p>Hey kiddo! We built this fun summer vacation picker for you.</p>
            <p>Here's how it works: You pick two summer camps, and 1 thing you wanna do every week, and we'll get you signed up and take care of the rest!</p>
            <button className="tutorial-btn" onClick={() => setTutorialStep(1)}>Let's Build It!</button>
          </div>
        </div>
      )}

      {/* Custom Name Interstitial */}
      {customPromptData && (
        <div className="tutorial-overlay">
          <div className="tutorial-modal">
            <h2>What do you want to do?</h2>
            <input 
               type="text" 
               id="customActivityInput"
               placeholder="e.g., Art Class"
               className="custom-text-input"
               autoFocus
               onKeyDown={(e) => {
                 if (e.key === 'Enter') {
                    const val = typeof document !== 'undefined' ? document.getElementById('customActivityInput').value : '';
                    if (val) {
                      commitWeeklyActivity(val, customPromptData.dayOfWeek);
                      setCustomPromptData(null);
                    }
                 }
               }}
            />
            <div style={{marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'center'}}>
              <button className="tutorial-btn" style={{background: 'var(--block-gray)'}} onClick={() => setCustomPromptData(null)}>Cancel</button>
              <button className="tutorial-btn" onClick={() => {
                if (typeof document !== 'undefined') {
                  const val = document.getElementById('customActivityInput').value;
                  if (val) {
                    commitWeeklyActivity(val, customPromptData.dayOfWeek);
                    setCustomPromptData(null);
                  }
                }
              }}>Add It!</button>
            </div>
          </div>
        </div>
      )}

      {/* NASA Special Warning Popup */}
      {nasaPopupActive && (
        <div className="tutorial-overlay">
          <div className="tutorial-modal">
            <h2>A SPECIAL CHOICE! 🚀</h2>
            <p>NASA Space Academy is an amazing, high-tech experience.</p>
            <p><strong>This camp is really special, so if you pick it, it'll be the only summer camp we can do this summer!</strong></p>
            <button className="tutorial-btn" onClick={() => setNasaPopupActive(false)}>Got It!</button>
          </div>
        </div>
      )}

      {/* 3. Interstitial Summary Modal */}
      {tutorialStep === 3 && (
        <div className="tutorial-overlay">
          <div className="tutorial-modal recap-modal">
            <h2>Okay great! Here are the camps you picked:</h2>
            <ul className="recap-list" style={{ fontSize: '1rem' }}>
              {Array.from(activeCampIds).map(id => {
                 const campItem = allPieces.find(p => p.id === id);
                 // Only show exactly ONE list item per unique camp sequence (first piece)
                 // Wait, since each piece spans multiple days, they already have exactly ONE id
                 return <li key={id}>⭐️ {campItem?.title}</li>
              })}
            </ul>
            <p style={{marginTop:'20px'}}>Now let's pick at least one weekly thing for the rest of the summer.</p>
            <p>Boxing, a summer job, volunteering, or name your own!</p>
            <button className="tutorial-btn" onClick={() => setTutorialStep(4)}>Next: Weekly Activities</button>
          </div>
        </div>
      )}

      {/* 5. Recap Screen */}
      {tutorialStep === 5 && (
        <div className="tutorial-overlay">
          <div className="tutorial-modal recap-modal">
            <h2>SUMMER LOCKED IN! 🚀</h2>
            <p>You have successfully scheduled:</p>
            <ul className="recap-list">
               <li>Camps: {campsCount}</li>
               <li>Weekly Activities: {weeklyCount}</li>
               <li>Family Trips: {summerData.fixed_events.length}</li>
            </ul>
            <p style={{marginTop: '20px'}}>Have an amazing summer!</p>
            <button className="tutorial-btn" onClick={() => setTutorialStep(6)}>View Calendar!</button>
          </div>
        </div>
      )}

      <header className="header">
        <div className="header-left">
          <h1>Summer Planner</h1>
          <div className="view-controls">
            <button 
              className={`view-btn ${isWeekdayOnly ? 'active' : ''}`} 
              onClick={(e) => { e.stopPropagation(); setIsWeekdayOnly(!isWeekdayOnly); }}
              title="Toggle Weekends"
            >
              {isWeekdayOnly ? "📅 7-Day" : "📅 5-Day"}
            </button>
            <button 
              className={`view-btn ${isZoomedOut ? 'active' : ''}`} 
              onClick={(e) => { e.stopPropagation(); setIsZoomedOut(!isZoomedOut); }}
              title="Toggle Zoom"
            >
              {isZoomedOut ? "🔍 Zoom In" : "🔍 Zoom Out"}
            </button>
          </div>
        </div>
        <div className="stats-box">
           <div>Camps: {campsCount}/{campsTarget}</div>
           <div>Weekly: {weeklyCount}/1</div>
        </div>
      </header>

      {/* Step 1 Progression Banner */}
      {tutorialStep === 1 && (
         <div className="finish-banner" style={{ background: 'var(--block-cyan)' }} onClick={() => setTutorialStep(2)}>
            GOT IT! LET'S PICK CAMPS ➔
         </div>
      )}

      {/* Step 2 Progression Banner */}
      {campsCount >= campsTarget && tutorialStep === 2 && (
         <div className="finish-banner" onClick={() => setTutorialStep(3)}>
            DONE PICKING CAMPS!
         </div>
      )}

      {/* Step 4 Progression Banner */}
      {weeklyCount >= 1 && tutorialStep === 4 && (
         <div className="finish-banner" onClick={() => setTutorialStep(5)}>
            FINISH SCHEDULE
         </div>
      )}
      
      {/* Step 6 Reset Option (Optional, maybe she wants to edit) */}
      {tutorialStep === 6 && (
        <div className="finish-banner" style={{background: 'var(--block-gray)'}} onClick={() => setTutorialStep(2)}>
           RE-EDIT SCHEDULE
        </div>
      )}
      
      {/* Drag Tray at Bottom */}
      {tutorialStep === 4 && (
        <div className="drag-tray">
           <h4>Drag elements into calendar to schedule! ➔</h4>
           <div className="tray-items">
              
              {/* L piece (Boxing) */}
              <div 
                   className={`tetromino-shape ${selectedTrayType === 'boxing' ? 'tray-selected' : ''}`}
                   draggable 
                   onDragStart={e => {
                     e.dataTransfer.setData('type', 'boxing');
                     setDraggingType('boxing');
                     setSelectedTrayType(null);
                   }} 
                   onDragEnd={() => setDraggingType(null)}
                   onClick={(e) => {
                     e.stopPropagation();
                     setSelectedTrayType(prev => prev === 'boxing' ? null : 'boxing');
                   }}
                   style={{ gridTemplateColumns: 'repeat(3, 30px)', gridTemplateRows: 'repeat(2, 30px)' }}>
                 <div className="t-cube color-weekly" style={{gridColumn: '1 / 4', gridRow: '2'}}/>
                 <div className="t-cube color-weekly" style={{gridColumn: '3', gridRow: '1'}}/>
                 <span className="tetro-label">Boxing</span>
              </div>

              {/* Line piece (Summer Job) */}
              <div 
                   className={`tetromino-shape ${selectedTrayType === 'job' ? 'tray-selected' : ''}`}
                   draggable 
                   onDragStart={e => {
                     e.dataTransfer.setData('type', 'job');
                     setDraggingType('job');
                     setSelectedTrayType(null);
                   }} 
                   onDragEnd={() => setDraggingType(null)}
                   onClick={(e) => {
                     e.stopPropagation();
                     setSelectedTrayType(prev => prev === 'job' ? null : 'job');
                   }}
                   style={{ gridTemplateColumns: 'repeat(4, 30px)', gridTemplateRows: '30px' }}>
                 <div className="t-cube color-job"/>
                 <div className="t-cube color-job"/>
                 <div className="t-cube color-job"/>
                 <div className="t-cube color-job"/>
                 <span className="tetro-label">Summer Job</span>
              </div>

              {/* Square piece (Volunteer) */}
              <div 
                   className={`tetromino-shape ${selectedTrayType === 'volunteer' ? 'tray-selected' : ''}`}
                   draggable 
                   onDragStart={e => {
                     e.dataTransfer.setData('type', 'volunteer');
                     setDraggingType('volunteer');
                     setSelectedTrayType(null);
                   }} 
                   onDragEnd={() => setDraggingType(null)}
                   onClick={(e) => {
                     e.stopPropagation();
                     setSelectedTrayType(prev => prev === 'volunteer' ? null : 'volunteer');
                   }}
                   style={{ gridTemplateColumns: 'repeat(2, 30px)', gridTemplateRows: 'repeat(2, 30px)' }}>
                 <div className="t-cube color-family_trip"/>
                 <div className="t-cube color-family_trip"/>
                 <div className="t-cube color-family_trip"/>
                 <div className="t-cube color-family_trip"/>
                 <span className="tetro-label">Volunteer</span>
              </div>

              {/* T piece (Custom) */}
              <div 
                   className={`tetromino-shape ${selectedTrayType === 'custom' ? 'tray-selected' : ''}`}
                   draggable 
                   onDragStart={e => {
                     e.dataTransfer.setData('type', 'custom');
                     setDraggingType('custom');
                     setSelectedTrayType(null);
                   }} 
                   onDragEnd={() => setDraggingType(null)}
                   onClick={(e) => {
                     e.stopPropagation();
                     setSelectedTrayType(prev => prev === 'custom' ? null : 'custom');
                   }}
                   style={{ gridTemplateColumns: 'repeat(3, 30px)', gridTemplateRows: 'repeat(2, 30px)' }}>
                 <div className="t-cube color-skills" style={{gridColumn: '1 / 4', gridRow: '1'}}/>
                 <div className="t-cube color-skills" style={{gridColumn: '2', gridRow: '2'}}/>
                 <span className="tetro-label">Name your own!</span>
              </div>

           </div>
        </div>
      )}

      <main className="timeline-scroll">
        <div className="calendar-grid">
          {WEEKS_ARRAY.map((originalWeekDays, wIdx) => {
            const weekDays = isWeekdayOnly ? originalWeekDays.slice(1, 6) : originalWeekDays;
            const weekStart = originalWeekDays[0];
            const weekEnd = originalWeekDays[6];
            let weekPieces = allPieces.filter(p => p.endDate >= weekStart && p.startDate <= weekEnd);

            // Filter out items that won't be rendered
            weekPieces = weekPieces.filter(piece => {
              if (tutorialStep === 1 && campsCount < 2 && piece.type === 'weekly') return false;
              return true;
            });

            // Sort to pack properly
            weekPieces.sort((a, b) => {
              if (a.startDate.getTime() !== b.startDate.getTime()) return a.startDate - b.startDate;
              return (b.endDate - b.startDate) - (a.endDate - a.startDate);
            });

            // Lane packing
            const lanes = [];
            const pieceLanes = new Map();
            weekPieces.forEach(p => {
              let placed = false;
              for (let i = 0; i < lanes.length; i++) {
                if (lanes[i] < p.startDate) {
                  pieceLanes.set(p.id, i);
                  lanes[i] = p.endDate;
                  placed = true;
                  break;
                }
              }
              if (!placed) {
                pieceLanes.set(p.id, lanes.length);
                lanes.push(p.endDate);
              }
            });

            const reqHeight = Math.max(90, 60 + lanes.length * 50);
            const mCfg = getMonthConfig(weekStart);

            return (
              <div key={wIdx} className={`week-wrapper ${isZoomedOut ? 'zoomed-out' : ''}`}>
                <div className="month-label" style={{ color: mCfg.color.replace('0.05', '1') }}>
                   {mCfg.name}
                </div>
                <div className={`week-row ${isWeekdayOnly ? 'weekday-only' : ''}`} style={{ minHeight: `${reqHeight}px`, backgroundColor: mCfg.color }}>
                  
                  {/* Background grid */}
                  <div className="week-bg">
                    {weekDays.map((d, dIdx) => {
                      const dayNum = getDay(d);
                      const isDragging = draggingType !== null;
                      const activeType = draggingType || selectedTrayType;
                      const isEligible = activeType && (activeType !== 'boxing' || [1, 3, 6].includes(dayNum));

                      // Check if there's a hidden weekend activity for this week
                      const hasWeekendActivity = isWeekdayOnly && dIdx === 4 && weekPieces.some(p => {
                         const pDay = getDay(p.startDate);
                         return (pDay === 0 || pDay === 6) && activeIds.has(p.id);
                      });

                      return (
                        <div 
                           key={dIdx} 
                           className={`day-col ${dIdx === 0 || dIdx === 6 || (isWeekdayOnly && (dIdx === -1)) ? 'weekend' : ''} ${isEligible ? 'drop-eligible' : ''} ${hoveredDayKey === `${wIdx}-${dIdx}` || (selectedTrayType && isEligible) ? 'hover-active' : ''}`}
                           onDragOver={(e) => {
                             if (isEligible) e.preventDefault();
                           }}
                           onDragEnter={() => {
                             if (isEligible) setHoveredDayKey(`${wIdx}-${dIdx}`);
                           }}
                           onDragLeave={() => setHoveredDayKey(null)}
                           onClick={() => {
                             if (selectedTrayType && isEligible) {
                               const type = selectedTrayType;
                               if (type === 'custom') {
                                 setCustomPromptData({ dayOfWeek: dayNum });
                               } else {
                                 let title = 'Weekly Activity';
                                 if (type === 'boxing') title = 'Boxing';
                                 if (type === 'job') title = 'Summer Job';
                                 if (type === 'volunteer') title = 'Volunteer';
                                 commitWeeklyActivity(title, dayNum);
                               }
                               setSelectedTrayType(null);
                             }
                           }}
                           onDrop={(e) => {
                             setHoveredDayKey(null);
                             if (isEligible) {
                               handleDrop(e, d);
                               setDraggingType(null);
                             }
                           }}
                        >
                          <div className="day-header-drop-zone">
                            <div className="day-header">{format(d, 'EEE')}</div>
                            <div className="day-number">{format(d, 'd')}</div>
                            {hasWeekendActivity && <div className="weekend-indicator" title="Events scheduled on weekend">★</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="events-layer">
                    {weekPieces.map(p => renderBlockForWeek(weekDays, p, pieceLanes.get(p.id)))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
