import './board.css';
import { useState, useRef, useEffect } from 'react';
import dropSoundFile from '../sound/drop.mp3';
import winSoundFile from '../sound/win2.mp3';
import clickSoundFile from '../sound/click.mp3';

export const Board = () => {
  const [inputValue, setInputValue] = useState('');
  const [centerCubes, setCenterCubes] = useState([]);
  const [letters, setLetters] = useState([]);
  const [draggingIndex, setDraggingIndex] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [fireworks, setFireworks] = useState([]);
  const [scatteredPieces, setScatteredPieces] = useState([]);
  const [gameOver, setGameOver] = useState(false);
  const boardRef = useRef(null);

  const cubeSize = 60;
  const SAFE_ZONE = { top: 100, left: 80, right: 80, bottom: 80 };

  const dropSound = useRef(null);
  const winSound = useRef(null);
  const clickSound = useRef(null);

  useEffect(() => {
    dropSound.current = new Audio(dropSoundFile);
    winSound.current = new Audio(winSoundFile);
    clickSound.current = new Audio(clickSoundFile);
  }, []);

  const generateNonOverlappingPosition = (existingBoxes, boardWidth, boardHeight, centerCubes) => {
  const padding = 25; 
  const maxTries = 1500;
  const minDistance = cubeSize + padding;

  for (let i = 0; i < maxTries; i++) {
    const x = SAFE_ZONE.left + Math.random() * (boardWidth - cubeSize - SAFE_ZONE.left - SAFE_ZONE.right);
    const y = SAFE_ZONE.top + Math.random() * (boardHeight - cubeSize - SAFE_ZONE.top - SAFE_ZONE.bottom);

    const tooCloseToLetter = existingBoxes.some((box) => {
      const dx = x - box.x;
      const dy = y - box.y;
      return Math.sqrt(dx * dx + dy * dy) < minDistance;
    });

    const tooCloseToCube = centerCubes.some((cube) => {
      const dx = x - cube.x;
      const dy = y - cube.y;
      return Math.sqrt(dx * dx + dy * dy) < minDistance;
    });

    if (!tooCloseToLetter && !tooCloseToCube) return { x, y };
  }

  // fallback (rare)
  return {
    x: SAFE_ZONE.left + Math.random() * (boardWidth - cubeSize - SAFE_ZONE.left - SAFE_ZONE.right),
    y: SAFE_ZONE.top + Math.random() * (boardHeight - cubeSize - SAFE_ZONE.top - SAFE_ZONE.bottom),
  };
};



  const handleShowCenter = () => {
  if (gameOver || !inputValue) return;

  clickSound.current.currentTime = 0;
  clickSound.current.play();

  
  setTimeout(() => {
    const boardRect = boardRef.current?.getBoundingClientRect();
    if (!boardRect || boardRect.width === 0 || boardRect.height === 0) {
     
      requestAnimationFrame(handleShowCenter);
      return;
    }

    const boardWidth = boardRect.width;
    const boardHeight = boardRect.height;

    const centerCubesArray = inputValue.split('').map((ch, i) => {
      const left = boardWidth / 2 - (inputValue.length * cubeSize) / 2 + i * cubeSize;
      const top = boardHeight / 2;
      return { char: ch, filled: false, x: left, y: top, id: i, winEffect: false };
    });
    setCenterCubes(centerCubesArray);

    
    const existingBoxes = [...centerCubesArray];
    const newLetters = inputValue.split('').map((ch, i) => {
      const pos = generateNonOverlappingPosition(
        existingBoxes,
        boardWidth,
        boardHeight,
        centerCubesArray
      );
      existingBoxes.push(pos);
      return {
        char: ch,
        x: (pos.x / boardWidth) * 100,
        y: (pos.y / boardHeight) * 100,
        id: i,
        fading: false,
      };
    });

    setLetters(newLetters);
    setFireworks([]);
    setScatteredPieces([]);

   
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      document.activeElement?.blur(); 
    }, 100);
  }, 100);
};

  const handleDown = (index, e) => {
    if (gameOver) return;
    const clientX = e.clientX ?? e.touches?.[0]?.clientX;
    const clientY = e.clientY ?? e.touches?.[0]?.clientY;
    if (!clientX || !clientY) return;

    setDraggingIndex(index);
    const rect = e.target.getBoundingClientRect();
    setDragOffset({ x: clientX - rect.left, y: clientY - rect.top });
  };

  const handleMove = (e) => {
    if (draggingIndex === null || gameOver) return;
    const clientX = e.clientX ?? e.touches?.[0]?.clientX;
    const clientY = e.clientY ?? e.touches?.[0]?.clientY;
    if (!clientX || !clientY) return;

    const boardRect = boardRef.current.getBoundingClientRect();
    const x = ((clientX - boardRect.left - dragOffset.x) / boardRect.width) * 100;
    const y = ((clientY - boardRect.top - dragOffset.y) / boardRect.height) * 100;

    setLetters((prev) =>
      prev.map((l, i) => (i === draggingIndex ? { ...l, x, y } : l))
    );
  };

  

const handleUp = () => {
  if (draggingIndex === null || gameOver) return;
  const boardRect = boardRef.current.getBoundingClientRect();
  const letter = letters[draggingIndex];

  let snappedIndex = null;

  setCenterCubes((prevCubes) => {
    const updatedCubes = prevCubes.map((cube, i) => {
      if (cube.filled) return cube;

      // find DOM elements for cube and letter
      const cubeElem = boardRef.current.querySelector(`[data-cube-id="${cube.id}"]`);
      const letterElem = boardRef.current.querySelector(`[data-letter-id="${letter.id}"]`);

      if (!cubeElem || !letterElem) return cube;

      const cubeRect = cubeElem.getBoundingClientRect();
      const letterRect = letterElem.getBoundingClientRect();

      // Compute centers relative to board (pixels)
      const cubeCenterX = cubeRect.left - boardRect.left + cubeRect.width / 2;
      const cubeCenterY = cubeRect.top - boardRect.top + cubeRect.height / 2;
      const letterCenterX = letterRect.left - boardRect.left + letterRect.width / 2;
      const letterCenterY = letterRect.top - boardRect.top + letterRect.height / 2;

      // distance between centers
      const dx = letterCenterX - cubeCenterX;
      const dy = letterCenterY - cubeCenterY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // threshold: half-diagonal sum (safe) or smaller value if you want stricter snapping
      const cubeRadius = Math.sqrt((cubeRect.width ** 2 + cubeRect.height ** 2)) / 2;
      const letterRadius = Math.sqrt((letterRect.width ** 2 + letterRect.height ** 2)) / 2;
      const threshold = cubeRadius + letterRadius; // touching/overlap threshold

      // match char and within threshold
      if (dist <= threshold && letter.char === cube.char) {
        snappedIndex = i;

        // snap letter to cube position (store as percents to match letter state)
        const snappedLeftPercent = ((cubeRect.left - boardRect.left) / boardRect.width) * 100;
        const snappedTopPercent = ((cubeRect.top - boardRect.top) / boardRect.height) * 100;

        setLetters((prevLetters) =>
          prevLetters.map((l, idx) =>
            idx === draggingIndex
              ? { ...l, x: snappedLeftPercent, y: snappedTopPercent, fading: true }
              : l
          )
        );

        dropSound.current.currentTime = 0;
        dropSound.current.play();

        // mark cube filled and keep its x,y as current top-left in pixels (optional)
        return { ...cube, filled: true };
      }

      return cube;
    });

    // check all filled
    const allFilled = updatedCubes.length > 0 && updatedCubes.every((c) => c.filled);
    if (allFilled) {
      winSound.current.currentTime = 0;
      winSound.current.play();
      updatedCubes.forEach((c) => (c.winEffect = true));
      setGameOver(true);

      setTimeout(() => {
        triggerFireworks(updatedCubes);
        throwScatteredPieces(updatedCubes);
      }, 200);
    }

    return updatedCubes;
  });

  if (snappedIndex !== null) {
    // remove letter from letters after fade-out so user sees snap
    setTimeout(() => {
      setLetters((prev) => prev.filter((_, i) => i !== draggingIndex));
    }, 200);
  }

  setDraggingIndex(null);
};

  const triggerFireworks = (cubes) => {
    const effects = cubes.map((cube, i) => ({
      id: i,
      x: cube.x + cubeSize / 2,
      y: cube.y + cubeSize / 2,
    }));
    setFireworks(effects);
    setTimeout(() => setFireworks([]), 2500);
  };

  const throwScatteredPieces = (cubes) => {
    const boardRect = boardRef.current.getBoundingClientRect();
    const pieces = [];

    cubes.forEach((cube) => {
      for (let i = 0; i < 25; i++) {
        const angle = Math.random() * 2 * Math.PI;
        const distance = 200 + Math.random() * 100;
        const dx = Math.cos(angle) * distance;
        const dy = Math.sin(angle) * distance;

        const finalX = cube.x + cubeSize / 2 + dx;
        const finalY = cube.y + cubeSize / 2 + dy;

        const xPercent = (finalX / boardRect.width) * 100;
        const yPercent = (finalY / boardRect.height) * 100;

        pieces.push({
          id: `${cube.id}-${i}-${Date.now()}`,
          color: `hsl(${Math.random() * 360}, 80%, 60%)`,
          size: Math.random() * 8 + 4,
          x: xPercent,
          y: yPercent,
          rotate: Math.random() * 360,
        });
      }
    });

    setScatteredPieces((prev) => [...prev, ...pieces]);
  };

  const resetGame = () => {
    setInputValue('');
    setCenterCubes([]);
    setLetters([]);
    setFireworks([]);
    setScatteredPieces([]);
    setDraggingIndex(null);
    setGameOver(false);
  };

  const allFilled = centerCubes.length > 0 && centerCubes.every((c) => c.filled);

  return (
    <div
      className="board"
      ref={boardRef}
      onMouseMove={handleMove}
      onMouseUp={handleUp}
      onTouchMove={handleMove}
      onTouchEnd={handleUp}
    >
      {gameOver && (
        <button className="resetBtn" onClick={resetGame}>
          თავიდან დაწყება
        </button>
      )}

      <div className="inputValue">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value.toUpperCase())}
          disabled={gameOver}
        />
        <button className="showBtn" onClick={handleShowCenter} disabled={gameOver}>
          ითამაშე
        </button>
        <label className='label'>შეიყვანე შენი სახელი</label>
      </div>

      <div className="main-board">
        {centerCubes.map((cube) => (
          <div
            key={cube.id}
            data-cube-id={cube.id} 
            className={`cube ${cube.filled ? 'filled' : ''} ${cube.winEffect ? 'win' : ''}`}
            style={{ top: `${cube.y}px`, left: `${cube.x}px` }}
          >
            {cube.char}
          </div>
        ))}

        {letters.map((letter, i) => (
          <div
            key={letter.id}
            data-letter-id={letter.id} 
            className={`letter-box ${letter.fading ? 'fade-out' : ''}`}
            style={{ top: `${letter.y}%`, left: `${letter.x}%` }}
            onMouseDown={(e) => handleDown(i, e)}
            onTouchStart={(e) => handleDown(i, e)}
          >
            {letter.char}
          </div>
        ))}

        {fireworks.map((fw) => (
          <div key={fw.id} className="firework" style={{ top: fw.y, left: fw.x }}>
            {Array.from({ length: 12 }).map((_, j) => (
              <span key={j} className="particle" style={{ '--i': j }}></span>
            ))}
          </div>
        ))}

        {scatteredPieces.map((p) => (
          <div
            key={p.id}
            className="scatter-piece"
            style={{
              top: `${p.y}%`,
              left: `${p.x}%`,
              backgroundColor: p.color,
              width: `${p.size}px`,
              height: `${p.size}px`,
              transform: `rotate(${p.rotate}deg)`,
            }}
          />
        ))}

        {allFilled && (
          <div className="win-message">
            <h5 className="opa">
              ყოჩაღ <span>{inputValue}</span> შენ წარმატებით <br />გაართვი თავი ამ დავალებას
            </h5>
          </div>
        )}
      </div>
    </div>
  );
};