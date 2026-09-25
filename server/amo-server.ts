import 'dotenv/config';
import express from 'express'; import cors from 'cors'; import { createServer } from 'node:http'; import { Server } from 'socket.io';
import { createRoom, joinRoom, startGame, submitAnswer, endRound, nextRound, removeSocket, getRoom, publicRoom } from './quizGame.js';
import type { QuizRoom } from './quizTypes.js';
const app=express(); app.use(cors({origin:true})); app.get('/api/health',(_req,res)=>res.json({ok:true,name:'Amo Arena'}));
const httpServer=createServer(app); const io=new Server(httpServer,{cors:{origin:true,methods:['GET','POST']}});
const roundTimers = new Map<string, ReturnType<typeof setTimeout>>();
const clearRoundTimer = (roomId:string) => { const timer=roundTimers.get(roomId); if (timer) clearTimeout(timer); roundTimers.delete(roomId); };
const broadcast=(room:QuizRoom,event:string,payload?:unknown)=>io.to(room.id).emit(event,payload??publicRoom(room));
const finishRound = (room:QuizRoom) => {
  if (room.status !== 'playing') return;
  clearRoundTimer(room.id);
  try { broadcast(room,'quiz_round_result',endRound(room,room.hostId)); } catch { /* The room may have been closed while the timer fired. */ }
};
const scheduleRoundEnd = (room:QuizRoom) => {
  clearRoundTimer(room.id);
  const delay = Math.max(0, (room.roundDeadline ?? Date.now()) - Date.now()) + 50;
  roundTimers.set(room.id, setTimeout(() => finishRound(room), delay));
};
io.on('connection',socket=>{
  socket.on('quiz_create_room',(data,cb)=>{ try { const x=createRoom(String(data.nickname??'').trim(),data.mode==='team'?'team':'solo'); socket.join(x.room.id); socket.data.playerId=x.playerId; socket.data.roomId=x.room.id; cb({success:true,room:x.room,playerId:x.playerId}); broadcast(x.room,'quiz_room_updated'); } catch(e) { cb({success:false,error:(e as Error).message}); } });
  socket.on('quiz_join_room',(data,cb)=>{ try { const x=joinRoom(String(data.roomId??''),String(data.nickname??'').trim()); socket.join(x.room.id); socket.data.playerId=x.playerId; socket.data.roomId=x.room.id; cb({success:true,room:x.room,playerId:x.playerId}); broadcast(x.room,'quiz_room_updated'); } catch(e) { cb({success:false,error:(e as Error).message}); } });
  socket.on('quiz_start_game',(data,cb)=>{ try { const room=getRoom(data.roomId); if(!room) throw new Error('Oda bulunamadı'); const payload=startGame(room,socket.data.playerId); cb({success:true}); scheduleRoundEnd(room); broadcast(room,'quiz_game_started',payload); broadcast(room,'quiz_room_updated'); } catch(e) { cb({success:false,error:(e as Error).message}); } });
  socket.on('quiz_submit_answer',(data,cb)=>{ try { const room=getRoom(data.roomId); if(!room) throw new Error('Oda bulunamadı'); if (room.roundDeadline && Date.now()>room.roundDeadline) throw new Error('Süre doldu'); const answer=submitAnswer(room,socket.data.playerId,data.answer); cb({success:true,answer}); broadcast(room,'quiz_player_answered',{playerId:socket.data.playerId,answeredCount:room.answered.length,totalPlayers:room.players.length}); if(room.answered.length===room.players.length) setTimeout(()=>finishRound(room),1000); } catch(e) { cb({success:false,error:(e as Error).message}); } });
  socket.on('quiz_end_round',(data,cb)=>{ try { const room=getRoom(data.roomId); if(!room) throw new Error('Oda bulunamadı'); const result=endRound(room,socket.data.playerId); clearRoundTimer(room.id); cb({success:true,result}); broadcast(room,'quiz_round_result',result); } catch(e) { cb({success:false,error:(e as Error).message}); } });
  socket.on('quiz_next_round',(data,cb)=>{ try { const room=getRoom(data.roomId); if(!room) throw new Error('Oda bulunamadı'); const result=nextRound(room,socket.data.playerId); cb({success:true,...result}); if(result.finished) { clearRoundTimer(room.id); broadcast(room,'quiz_game_finished',result); } else { scheduleRoundEnd(room); broadcast(room,'quiz_game_started',result); } broadcast(room,'quiz_room_updated'); } catch(e) { cb({success:false,error:(e as Error).message}); } });
  socket.on('disconnect',()=>{ const x=removeSocket(socket.data.playerId); if (x?.hostGone) { clearRoundTimer(x.roomId); io.to(x.roomId).emit('quiz_host_disconnected',{message:'Host ayrıldı, oda kapatıldı'}); } else if(x?.roomId) { const room=getRoom(x.roomId); if(room) broadcast(room,'quiz_room_updated'); } });
});
const port=Number(process.env.PORT||3001); httpServer.listen(port,()=>console.log(`Amo Arena server listening on ${port}`));
