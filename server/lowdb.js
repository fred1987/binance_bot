import {join} from 'path';
import {Low, JSONFile} from 'lowdb';

const root = join.bind(this, process.cwd(), './');
const adapter = new JSONFile(root('db.json'));
const db = new Low(adapter);

export default db;
