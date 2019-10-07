const Room = require("./room");
const uuid = require('uuid/v4');

class GameManager {

    constructor(binary=false) {
        this.rooms = new Map();
        this.users = new Map();
        this.binary = binary;
    }

    createRoom(name, username, settings, game, gameOver) {
        const id = uuid();
        const r = new Room(name, id, settings);
        this.rooms.set(id, r);
        this.addUserToRoom(username, r);
        r.setGameCallback(game);
        r.setGameOverCallback(gameOver);
        return true;
    }

    createEmptyRoom(name, settings, game, gameOver) {
        const id = uuid();
        const r = new Room(name, id, settings);
        this.rooms.set(id, r);
        r.setGameCallback(game);
        r.setGameOverCallback(gameOver);
        return true;
    }

    hasRoom(roomid) {
        return this.rooms.has(roomid);
    }

    getRoom(roomid) {
        const room = this.rooms.get(roomid);
        return room !== undefined ? room : null;
    }

    forRoom(f) {
        this.rooms.forEach(room => {
            f(room);
        });
    }

    addUserToRoom(username, room) {
        const index = room.addUser();
        if (index >= 0) {
            let user = this.getUser(username);
            if (user !== null) {
                user.index = index;
            } else {
                user = {
                    index: index,
                    name: username,
                    id: room.id
                };
            }
            this.setUser(username, user);
        }
    }

    hasUser(username) {
        return this.users.has(username);
    }

    getUser(username) {
        return this.hasUser(username) ? this.users.get(username) : null;
    }

    setUser(username, index, roomid=-1) {
        if (roomid > 0 || !this.users.has(username)) {
            this.users.set(username, {
                index: index,
                name: username,
                id: roomid
            });
            return true;
        }
        return false;
    }

    deleteUser(username) {
        return this.leaveRoom(username, true);
    }

    leaveRoom(username, remove=false) {
        const user = this.getUser(username);
        if (user === null) return null;

        const room = this.rooms.get(user.id);
        if (!remove && room === undefined) {
            return null;
        } else if (room !== undefined) {
            room.removeUser(user.index);
            // Log user leaving game
            console.info(`Player "${username}" left game "${room.name}"`);
        }

        if (remove) {
            this.users.delete(user);
            console.info(`Player "${username}" logged out"`);
        }

        return room;
    }

    joinRoom(user, roomid) {
        const room = this.getRoom(roomid);
        if (room === null) return null;

        this.addUserToRoom(user, room);

        return room;
    }

    running(room) {
        return room.gameStarted && !room.gameOver;
    }

    startGame(username) {
        const user = this.getUser(username);
        if (user === null) return null;

        const room = this.getRoom(user.id);
        if (room === null) return null;

        room.startGame();

        return room;
    }

    pause(roomid, username) {
        const room = this.getRoom(roomid);
        if (room === null) return false;

        const user = this.getUser(username);
        if (user === null) return false;

        return room.togglePause(user.index);
    }

    endGame(roomid, username) {
        const room = this.getRoom(roomid);
        if (room === null) return false;

        this.leaveRoom(username);
        room.stopGameLoop();
        room.reset();
    }

    info(room, username) {
        const user = this.getUser(username);
        if (user === null) return null;

        return {
            lobbyname: room.name,
            id: user.index,
            width: room.fieldWidth,
            height: room.fieldHeight,
            username: username,
            hash: user.hash,
            gameid: room.id,
            background: room.background,
            paused: room.paused
        }
    }

    applyMove(username, key) {
        const user = this.getUser(username);
        if (user === null) return null;

        const room = this.getRoom(user.id);
        if (room === null) return null;

        room.movestone(key, user.index);

        return room;
    }
}

module.exports = GameManager;
