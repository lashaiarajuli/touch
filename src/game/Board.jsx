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
    const padding = 10;
    const maxTries = 500;
    for (let i = 0; i < maxTries; i++) {
      const x = SAFE_ZONE.left + Math.random() * (boardWidth - cubeSize - SAFE_ZONE.left - SAFE_ZONE.right);
      const y = SAFE_ZONE.top + Math.random() * (boardHeight - cubeSize - SAFE_ZONE.top - SAFE_ZONE.bottom);

      const overlapWithLetters = existingBoxes.some((box) => {
        return !(
          x + cubeSize + padding < box.x ||
          x > box.x + cubeSize + padding ||
          y + cubeSize + padding < box.y ||
          y > box.y + cubeSize + padding
        );
      });

      const overlapWithCubes = centerCubes.some((cube) => {
        return !(
          x + cubeSize + padding < cube.x ||
          x > cube.x + cubeSize + padding ||
          y + cubeSize + padding < cube.y ||
          y > cube.y + cubeSize + padding
        );
      });

      if (!overlapWithLetters && !overlapWithCubes) return { x, y };
    }
    return { x: SAFE_ZONE.left, y: SAFE_ZONE.top };
  };

  const handleShowCenter = () => {
    if (gameOver || !inputValue) return;

    clickSound.current.currentTime = 0;
    clickSound.current.play();

    const boardRect = boardRef.current.getBoundingClientRect();
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
      const pos = generateNonOverlappingPosition(existingBoxes, boardWidth, boardHeight, centerCubesArray);
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
    const cubePixelSize = cubeSize;
    let snappedIndex = null;

    setCenterCubes((prevCubes) => {
      const updatedCubes = prevCubes.map((cube, i) => {
        if (!cube.filled) {
          const letterX = (letter.x / 100) * boardRect.width;
          const letterY = (letter.y / 100) * boardRect.height;
          const dx = Math.abs(letterX - cube.x);
          const dy = Math.abs(letterY - cube.y);

          if (dx < cubePixelSize / 2 && dy < cubePixelSize / 2 && letter.char === cube.char) {
            snappedIndex = i;

            setLetters((prevLetters) =>
              prevLetters.map((l, idx) =>
                idx === draggingIndex
                  ? { ...l, x: (cube.x / boardRect.width) * 100, y: (cube.y / boardRect.height) * 100, fading: true }
                  : l
              )
            );

            dropSound.current.currentTime = 0;
            dropSound.current.play();

            return { ...cube, filled: true };
          }
        }
        return cube;
      });

      const allFilled = updatedCubes.every((cube) => cube.filled);
      if (allFilled) {
        winSound.current.currentTime = 0;
        winSound.current.play();

        updatedCubes.forEach((cube) => (cube.winEffect = true));
        setGameOver(true);

        setTimeout(() => {
          triggerFireworks(updatedCubes);
          throwScatteredPieces(updatedCubes);
        }, 200);
      }

      return updatedCubes;
    });

    if (snappedIndex !== null) {
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
      </div>

      <div className="main-board">
        {centerCubes.map((cube) => (
          <div
            key={cube.id}
            className={`cube ${cube.filled ? 'filled' : ''} ${cube.winEffect ? 'win' : ''}`}
            style={{ top: `${cube.y}px`, left: `${cube.x}px` }}
          >
            {cube.char}
          </div>
        ))}

        {letters.map((letter, i) => (
          <div
            key={letter.id}
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