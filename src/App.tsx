/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RotateCcw, Trophy, User, AlertCircle, Info } from 'lucide-react';

type Player = 'Red' | 'Blue';
type CellValue = Player | null;
type GameMode = 'PvP' | 'PvE';

interface Position {
  row: number;
  col: number;
}

const GRID_SIZE = 7;
const WIN_COUNT = 4;

// Heuristic constants
const WIN_SCORE = 10000;
const THREE_IN_A_ROW = 100;
const TWO_IN_A_ROW = 10;

export default function App() {
  const [board, setBoard] = useState<CellValue[][]>(
    Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null))
  );
  const [gameMode, setGameMode] = useState<GameMode>('PvE');
  const [currentPlayer, setCurrentPlayer] = useState<Player>('Red');
  const [lastMove, setLastMove] = useState<Position | null>(null);
  const [winner, setWinner] = useState<Player | 'Draw' | null>(null);
  const [winningCells, setWinningCells] = useState<Position[]>([]);
  const [isAiThinking, setIsAiThinking] = useState(false);

  const checkWin = useCallback((currentBoard: CellValue[][], row: number, col: number, player: Player) => {
    const directions = [
      [0, 1],  // Horizontal
      [1, 0],  // Vertical
      [1, 1],  // Diagonal Down-Right
      [1, -1], // Diagonal Down-Left
    ];

    for (const [dr, dc] of directions) {
      let count = 1;
      const cells: Position[] = [{ row, col }];

      // Check positive direction
      for (let i = 1; i < WIN_COUNT; i++) {
        const nr = row + dr * i;
        const nc = col + dc * i;
        if (nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE && currentBoard[nr][nc] === player) {
          count++;
          cells.push({ row: nr, col: nc });
        } else break;
      }

      // Check negative direction
      for (let i = 1; i < WIN_COUNT; i++) {
        const nr = row - dr * i;
        const nc = col - dc * i;
        if (nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE && currentBoard[nr][nc] === player) {
          count++;
          cells.push({ row: nr, col: nc });
        } else break;
      }

      if (count >= WIN_COUNT) return cells;
    }
    return null;
  }, []);

  const getValidMoves = useCallback((currentLastMove: Position | null, currentBoard: CellValue[][]) => {
    if (!currentLastMove) {
      const moves: Position[] = [];
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          if (!currentBoard[r][c]) moves.push({ row: r, col: c });
        }
      }
      return moves;
    }

    const { row, col } = currentLastMove;
    const moves: Position[] = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = row + dr;
        const nc = col + dc;
        if (nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE && !currentBoard[nr][nc]) {
          moves.push({ row: nr, col: nc });
        }
      }
    }
    return moves;
  }, []);

  // --- AI Logic ---
  const evaluateBoard = (currentBoard: CellValue[][], player: Player) => {
    const opponent = player === 'Red' ? 'Blue' : 'Red';
    let score = 0;

    const checkLine = (r: number, c: number, dr: number, dc: number) => {
      let pCount = 0;
      let oCount = 0;
      for (let i = 0; i < WIN_COUNT; i++) {
        const nr = r + dr * i;
        const nc = c + dc * i;
        if (nr < 0 || nr >= GRID_SIZE || nc < 0 || nc >= GRID_SIZE) return 0;
        if (currentBoard[nr][nc] === player) pCount++;
        else if (currentBoard[nr][nc] === opponent) oCount++;
      }
      if (pCount > 0 && oCount > 0) return 0;
      if (pCount === 4) return WIN_SCORE;
      if (oCount === 4) return -WIN_SCORE;
      if (pCount === 3) return THREE_IN_A_ROW;
      if (oCount === 3) return -THREE_IN_A_ROW * 1.5; // Weight blocking opponent higher
      if (pCount === 2) return TWO_IN_A_ROW;
      if (oCount === 2) return -TWO_IN_A_ROW;
      return 0;
    };

    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        score += checkLine(r, c, 0, 1);
        score += checkLine(r, c, 1, 0);
        score += checkLine(r, c, 1, 1);
        score += checkLine(r, c, 1, -1);
      }
    }
    return score;
  };

  const minimax = (
    currentBoard: CellValue[][], 
    depth: number, 
    alpha: number, 
    beta: number, 
    isMaximizing: boolean, 
    lastPos: Position | null,
    aiPlayer: Player
  ): { score: number; move: Position | null } => {
    const validMoves = getValidMoves(lastPos, currentBoard);
    
    // Check terminal states
    if (lastPos) {
      const prevPlayer = isMaximizing ? (aiPlayer === 'Red' ? 'Blue' : 'Red') : aiPlayer;
      if (checkWin(currentBoard, lastPos.row, lastPos.col, prevPlayer)) {
        return { score: isMaximizing ? -WIN_SCORE + depth : WIN_SCORE - depth, move: null };
      }
    }
    if (validMoves.length === 0) return { score: 0, move: null };
    if (depth === 0) return { score: evaluateBoard(currentBoard, aiPlayer), move: null };

    let bestMove: Position | null = null;

    if (isMaximizing) {
      let maxEval = -Infinity;
      for (const move of validMoves) {
        currentBoard[move.row][move.col] = aiPlayer;
        const evaluation = minimax(currentBoard, depth - 1, alpha, beta, false, move, aiPlayer).score;
        currentBoard[move.row][move.col] = null;
        if (evaluation > maxEval) {
          maxEval = evaluation;
          bestMove = move;
        }
        alpha = Math.max(alpha, evaluation);
        if (beta <= alpha) break;
      }
      return { score: maxEval, move: bestMove };
    } else {
      let minEval = Infinity;
      const opponent = aiPlayer === 'Red' ? 'Blue' : 'Red';
      for (const move of validMoves) {
        currentBoard[move.row][move.col] = opponent;
        const evaluation = minimax(currentBoard, depth - 1, alpha, beta, true, move, aiPlayer).score;
        currentBoard[move.row][move.col] = null;
        if (evaluation < minEval) {
          minEval = evaluation;
          bestMove = move;
        }
        beta = Math.min(beta, evaluation);
        if (beta <= alpha) break;
      }
      return { score: minEval, move: bestMove };
    }
  };

  const executeMove = (row: number, col: number) => {
    if (winner || board[row][col]) return;

    const newBoard = board.map(r => [...r]);
    newBoard[row][col] = currentPlayer;
    setBoard(newBoard);
    setLastMove({ row, col });

    const winResult = checkWin(newBoard, row, col, currentPlayer);
    if (winResult) {
      setWinner(currentPlayer);
      setWinningCells(winResult);
      return;
    }

    const nextPlayer: Player = currentPlayer === 'Red' ? 'Blue' : 'Red';
    const nextValidMoves = getValidMoves({ row, col }, newBoard);
    
    if (nextValidMoves.length === 0) {
      setWinner('Draw');
    } else {
      setCurrentPlayer(nextPlayer);
    }
  };

  useEffect(() => {
    if (gameMode === 'PvE' && currentPlayer === 'Blue' && !winner && !isAiThinking) {
      setIsAiThinking(true);
      const timer = setTimeout(() => {
        const boardCopy = board.map(r => [...r]);
        const { move } = minimax(boardCopy, 5, -Infinity, Infinity, true, lastMove, 'Blue');
        if (move) {
          executeMove(move.row, move.col);
        }
        setIsAiThinking(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [currentPlayer, gameMode, winner]);

  const handleCellClick = (row: number, col: number) => {
    if (isAiThinking || (gameMode === 'PvE' && currentPlayer === 'Blue')) return;
    
    const validMoves = getValidMoves(lastMove, board);
    const isValid = validMoves.some(m => m.row === row && m.col === col);
    if (isValid) executeMove(row, col);
  };

  const resetGame = () => {
    setBoard(Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null)));
    setCurrentPlayer('Red');
    setLastMove(null);
    setWinner(null);
    setWinningCells([]);
    setIsAiThinking(false);
  };

  const validMoves = getValidMoves(lastMove, board);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-sans text-slate-900">
      <div className="max-w-md w-full space-y-6">
        {/* Header */}
        <div className="text-center space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">7x7 Strategic Connect</h1>
          <div className="flex justify-center gap-2 pt-2">
            <button 
              onClick={() => { setGameMode('PvE'); resetGame(); }}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${gameMode === 'PvE' ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 border border-slate-200'}`}
            >
              Vs AI
            </button>
            <button 
              onClick={() => { setGameMode('PvP'); resetGame(); }}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${gameMode === 'PvP' ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 border border-slate-200'}`}
            >
              2 Players
            </button>
          </div>
        </div>

        {/* Status Bar */}
        <div className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center space-x-3">
            <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-full transition-colors ${currentPlayer === 'Red' && !winner ? 'bg-red-100 text-red-600' : 'text-slate-400'}`}>
              <User className="w-4 h-4" />
              <span className="font-semibold text-sm">Player</span>
            </div>
            <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-full transition-colors ${currentPlayer === 'Blue' && !winner ? 'bg-blue-100 text-blue-600' : 'text-slate-400'}`}>
              <User className="w-4 h-4" />
              <span className="font-semibold text-sm">{gameMode === 'PvE' ? 'AI' : 'Blue'}</span>
              {isAiThinking && <motion.span animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1 }}>...</motion.span>}
            </div>
          </div>
          
          <button onClick={resetGame} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-500 hover:text-slate-900">
            <RotateCcw className="w-5 h-5" />
          </button>
        </div>

        {/* Game Board */}
        <div className="relative bg-white p-3 rounded-3xl shadow-xl border border-slate-200 select-none">
          <div className="grid grid-cols-7 gap-2">
            {board.map((row, rIdx) => 
              row.map((cell, cIdx) => {
                const isValid = validMoves.some(m => m.row === rIdx && m.col === cIdx);
                const isLastMove = lastMove?.row === rIdx && lastMove?.col === cIdx;
                const isWinningCell = winningCells.some(w => w.row === rIdx && w.col === cIdx);

                return (
                  <motion.button
                    key={`${rIdx}-${cIdx}`}
                    whileHover={!cell && isValid && !winner ? { scale: 1.05 } : {}}
                    whileTap={!cell && isValid && !winner ? { scale: 0.95 } : {}}
                    onClick={() => handleCellClick(rIdx, cIdx)}
                    disabled={isAiThinking}
                    className={`
                      aspect-square rounded-xl flex items-center justify-center relative overflow-hidden
                      ${!cell && isValid && !winner ? 'bg-slate-100 cursor-pointer shadow-inner' : 'bg-slate-50 cursor-default'}
                      ${isLastMove ? 'ring-2 ring-slate-400 ring-offset-2' : ''}
                      ${isWinningCell ? (cell === 'Red' ? 'ring-4 ring-red-500 ring-offset-2 bg-red-50' : 'ring-4 ring-blue-500 ring-offset-2 bg-blue-50') : ''}
                      transition-all duration-200
                    `}
                  >
                    <AnimatePresence mode="wait">
                      {cell && (
                        <motion.div
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          className={`w-4/5 h-4/5 rounded-lg shadow-md ${cell === 'Red' ? 'bg-red-500' : 'bg-blue-500'}`}
                        />
                      )}
                    </AnimatePresence>
                    {!cell && isValid && !winner && !isAiThinking && (
                      <div className={`w-2 h-2 rounded-full ${currentPlayer === 'Red' ? 'bg-red-200' : 'bg-blue-200'}`} />
                    )}
                  </motion.button>
                );
              })
            )}
          </div>

          <AnimatePresence>
            {winner && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 rounded-3xl z-10 flex items-center justify-center bg-slate-900/10 backdrop-blur-sm"
              >
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-white p-8 rounded-3xl shadow-2xl text-center space-y-4 border border-slate-100"
                >
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto text-white shadow-lg ${winner === 'Red' ? 'bg-red-500 shadow-red-200' : winner === 'Blue' ? 'bg-blue-500 shadow-blue-200' : 'bg-slate-400 shadow-slate-200'}`}>
                    {winner === 'Draw' ? <AlertCircle className="w-8 h-8" /> : <Trophy className="w-8 h-8" />}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">{winner === 'Draw' ? "It's a Draw!" : `${winner === 'Blue' && gameMode === 'PvE' ? 'AI' : winner} Wins!`}</h2>
                    <p className="text-slate-500 text-sm">
                      {winner === 'Red' && gameMode === 'PvE' ? "You outsmarted the AI!" : "Better luck next time!"}
                    </p>
                  </div>
                  <button onClick={resetGame} className="w-full py-3 px-6 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 transition-colors flex items-center justify-center space-x-2">
                    <RotateCcw className="w-4 h-4" />
                    <span>Play Again</span>
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 text-[11px] text-slate-500">
          <div className="flex items-center gap-2 mb-2 text-slate-700 font-bold">
            <Info className="w-3.5 h-3.5 text-blue-500" />
            <span>HOW TO PLAY</span>
          </div>
          <p>The AI will always play in one of the 8 empty cells around your last move. If you block its paths, it will try to find a new way to connect 4. Connect 4 horizontally, vertically or diagonally to win!</p>
        </div>
      </div>
    </div>
  );
}

