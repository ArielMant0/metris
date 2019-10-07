module.exports = {

    sendFieldData: function(field, binary=false) {
        return binary ? this.sendBinaryField(field) : field;
    },

    sendPlayerData: function(stones, binary=false) {
        if (binary) {
            return this.sendBinaryPlayers(stones);
        } else {
            const list = [stones.length];
            stones.forEach(function(item, index) {
                list[index] = item.pos;
            });
            return list;
        }
    },

    sendScoreData: function(score, binary=false) {
        return binary ? this.sendBinaryScalar(score) : score;
    },

    sendLevelData: function(level, binary=false) {
        return binary ? this.sendBinaryScalar(level) : level;
    },

    sendBinaryField: function(field) {
        const bufArr = new ArrayBuffer(field.length);
        const bufView = new Uint8Array(bufArr);
        for (let i = 0; i < field.length; i++) {
            bufView[i] = field[i];
        }
        return bufArr;
    },

    sendBinaryPlayers: function(players) {
        const bufArr = new ArrayBuffer(players.length);
        const bufView = new Uint8Array(bufArr);
        for (let i = 0; i < players.length; i++) {
            bufView[i] = players[i].pos;
        }
        return bufArr;
    },

    sendBinaryScalar: function(scalar) {
        const bufArr = new ArrayBuffer(2);
        const bufView = new Uint16Array(bufArr);
        bufView[0] = scalar;
        return bufArr;
    },

    sortBy: function(a, b) {
        if (a < b) return -1;
        else if (a > b) return 1;
        else return 0;
    }
};
