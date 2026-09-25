import { randomBytes, randomUUID } from 'node:crypto';
import type { QuizAnswer, QuizRoom, Question, Player } from './quizTypes.js';

const avatars = ['🏆','⭐','🎯','🎨','🚀','⚡'];
const [baseQuestionModule, extraQuestionModule] = await Promise.all([
  import('./questions.json', { with: { type: 'json' } }),
  import('./questions-extra.json', { with: { type: 'json' } })
]);
const questions = [...baseQuestionModule.default, ...extraQuestionModule.default] as Question[];
const rooms = new Map<string, QuizRoom>();
const normalize = (value: unknown) => String(value ?? '').trim().toLocaleLowerCase('tr-TR');
const shuffle = <T,>(items: T[]) => {
  const result = [...items];
  for (let i=result.length-1; i>0; i--) {
    const j=Math.floor(Math.random()*(i+1));
    [result[i],result[j]]=[result[j],result[i]];
  }
  return result;
};

export function createRoom(nickname: string, mode: 'solo'|'team') {
  const id = randomBytes(3).toString('hex').toUpperCase();
  const player: Player = { id: randomUUID(), nickname, isHost: true, team: mode==='team' ? 'A' : undefined, avatar: avatars[0], score: 0, streak: 0, connected: true };
  const room: QuizRoom = { id, mode, hostId: player.id, players: [player], status:'lobby', currentRound:0, totalRounds:10, questionOrder:[], answered:[], roundScores:{} };
  rooms.set(id, room); return { room, playerId: player.id };
}
export function joinRoom(id: string, nickname: string) {
  const room = rooms.get(id.toUpperCase()); if (!room) throw new Error('Oda bulunamadı');
  if (room.players.length >= 6) throw new Error('Oda dolu (6/6)'); if (room.status !== 'lobby') throw new Error('Oyun başlamış');
  const player: Player = { id: randomUUID(), nickname, isHost:false, team: room.mode==='team' ? (room.players.filter(p=>p.team==='A').length <= room.players.filter(p=>p.team==='B').length ? 'A':'B') : undefined, avatar:avatars[room.players.length], score:0, streak:0, connected:true };
  room.players.push(player); return { room, playerId: player.id };
}
export function getRoom(id:string) { return rooms.get(id); }
export function publicQuestion(question: Question): Question {
  const copy = structuredClone(question) as unknown as Record<string, unknown>;
  for (const key of ['correct_answer','correct_answers','correct_formation','correct_order','correct_matches','answer']) delete copy[key];
  if (copy.type === 'lightning' && Array.isArray(copy.questions)) {
    copy.questions = (copy.questions as unknown[]).map((item) => {
      if (Array.isArray(item)) return { question: String(item[0] ?? '') };
      const entry = item as Record<string, unknown>;
      return { question: String(entry.question ?? '') };
    });
  }
  return copy as unknown as Question;
}

export function publicRoom(room: QuizRoom): QuizRoom {
  return { ...room, question: room.question ? publicQuestion(room.question) : undefined };
}
export function startGame(room: QuizRoom, playerId: string) { if (room.hostId!==playerId) throw new Error('Yalnızca host oyunu başlatabilir'); if (room.players.length<2) throw new Error('En az 2 oyuncu gerekli'); room.status='playing'; room.currentRound=1; room.questionOrder=shuffle(questions).slice(0,room.totalRounds).map(question=>question.id); return startRound(room); }
export function startRound(room: QuizRoom) {
  const questionId=room.questionOrder?.[room.currentRound-1];
  const q=(questionId ? questions.find(question=>question.id===questionId) : undefined) ?? questions[(room.currentRound-1)%questions.length];
  const now=Date.now(); room.question=q; room.roundStartedAt=now; room.roundDeadline=now+q.time_limit*1000; room.answered=[]; room.roundScores={}; return { currentRound:room.currentRound, question:publicQuestion(q), totalRounds:room.totalRounds, serverNow:now, deadline:room.roundDeadline };
}
function scoreAnswer(question: Question, answer: unknown) {
  if (!answer) return { points:0, correct:false };
  if (question.type==='multiple_choice') return { points:normalize(answer)===normalize(question.correct_answer)?question.points:0, correct:normalize(answer)===normalize(question.correct_answer) };
  if (question.type==='lightning') {
    const a=Array.isArray(answer)?answer:[];
    const correct=a.filter((x,i)=>{
      const item = question.questions[i] as unknown as { question?: string; answer?: boolean } | [string, boolean] | undefined;
      const expected = Array.isArray(item) ? item[1] : item?.answer;
      return x === expected;
    }).length;
    return { points:correct*question.points_per_correct*question.multiplier, correct:correct===question.questions.length };
  }
  if (question.type==='top_5') { const a=Array.isArray(answer)?answer:[]; const correct=a.filter(x=>question.correct_answers.some(y=>normalize(y)===normalize(x))).length; return { points:correct*question.points_per_answer, correct:correct===question.correct_answers.length }; }
  if (question.type==='stat_detective') { const ok=normalize(answer)===normalize(question.correct_answer); return { points:ok ? 150 : 0, correct:ok }; }
  if (question.type==='formation_builder') { const a=(answer&&typeof answer==='object'?answer:{}) as Record<string,unknown>; const correct=Object.keys(question.correct_formation).filter(k=>normalize(a[k])===normalize(question.correct_formation[k])).length; return { points:Math.floor(correct/11*question.points), correct:correct===11 }; }
  if (question.type==='career_path') { const a=Array.isArray(answer)?answer:[]; const correct=a.length===question.correct_order.length && a.every((x,i)=>x===question.correct_order[i]); return { points:correct?question.points:0, correct }; }
  const a=(answer&&typeof answer==='object'?answer:{}) as Record<string,unknown>; const total=Object.keys(question.correct_matches).length; const correct=Object.keys(question.correct_matches).filter(k=>normalize(a[k])===normalize(question.correct_matches[k])).length; return { points:Math.floor(correct/total*question.points), correct:correct===total };
}
export function submitAnswer(room: QuizRoom, playerId: string, answer: unknown) {
  if (!room.question || room.status!=='playing') throw new Error('Aktif soru yok');
  // Server-side deadline validation
  if (room.roundDeadline && Date.now() > room.roundDeadline) throw new Error('Süre doldu, cevap geç kaldı');
  if (room.answered.some(a=>a.playerId===playerId)) throw new Error('Cevabın zaten gönderildi');
  const player=room.players.find(p=>p.id===playerId);
  if (!player) throw new Error('Oyuncu bulunamadı');
  const result=scoreAnswer(room.question, answer);
  const answered:QuizAnswer={playerId,answer,submittedAt:Date.now(),pointsEarned:result.points,correct:result.correct};
  if (result.correct) player.streak++; else player.streak=0;
  const base=result.points;
  const place=room.answered.filter(a=>a.correct).length;
  const speed=place===0?.3:place===1?.2:place===2?.1:0;
  const streak=result.correct&&player.streak>=3?.5:0;
  const earned=Math.floor(base*(1+speed+streak));
  answered.pointsEarned=earned;
  player.score+=earned;
  room.roundScores[playerId]=earned;
  room.answered.push(answered);
  return answered;
}
export function endRound(room: QuizRoom, playerId:string) { if (room.hostId!==playerId) throw new Error('Yalnızca host turu bitirebilir'); if (room.status!=='playing') throw new Error('Tur aktif değil'); const result={round:room.currentRound,question:publicQuestion(room.question!),answers:room.answered.map(a=>({...a,answer:undefined})),rankings:[...room.players].sort((a,b)=>b.score-a.score).map((p,i)=>({id:p.id,name:p.nickname,score:p.score,rank:i+1,roundScore:room.roundScores[p.id]??0}))}; room.status='results'; return result; }
export function nextRound(room:QuizRoom, playerId:string) { if (room.hostId!==playerId) throw new Error('Yalnızca host sonraki turu başlatabilir'); if (room.status!=='results') throw new Error('Sonuç ekranında değilsin'); if (room.currentRound>=room.totalRounds) { room.status='finished'; return {finished:true, finalRankings:[...room.players].sort((a,b)=>b.score-a.score).map((p,i)=>({id:p.id,name:p.nickname,score:p.score,rank:i+1}))}; } room.currentRound++; room.status='playing'; return {finished:false,...startRound(room)}; }
export function removeSocket(socketId:string) { for (const [id,room] of rooms) { const p=room.players.find(p=>p.id===socketId); if (p) { if (p.isHost) { rooms.delete(id); return { roomId:id, hostGone:true }; } p.connected=false; return {roomId:id,hostGone:false}; } } return undefined; }
