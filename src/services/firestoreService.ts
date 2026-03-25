import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  getDoc, 
  getDocs, 
  onSnapshot,
  getDocFromServer,
  FirestoreError
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { OperationType, FirestoreErrorInfo, Student, Log, Task } from '../types';

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const APP_ID = 'point-master-v8'; // Matching the HTML version's logic
const BASE_PATH = `artifacts/${APP_ID}/public/data`;

export const studentsRef = collection(db, BASE_PATH, 'students');
export const logsRef = collection(db, BASE_PATH, 'logs');
export const tasksRef = collection(db, BASE_PATH, 'tasks');

export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}

export async function addLog(targetId: string, action: string, detail: string) {
  try {
    const id = Date.now().toString() + Math.random().toString(36).substring(7);
    await setDoc(doc(logsRef, id), {
      targetId,
      action,
      detail,
      timestamp: Date.now()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'logs');
  }
}

export async function updateStudent(id: string, data: Partial<Student>) {
  try {
    await updateDoc(doc(studentsRef, id), data);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `students/${id}`);
  }
}

export async function createStudent(name: string) {
  try {
    const id = name.replace(/\s/g, '_') + '_' + Date.now().toString().slice(-4);
    await setDoc(doc(studentsRef, id), {
      name,
      points: 0,
      draws: 0,
      inventory: {},
      doubleDraw: false,
      maxPointsReached: 0
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'students');
  }
}

export async function deleteStudent(id: string) {
  try {
    await deleteDoc(doc(studentsRef, id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `students/${id}`);
  }
}

export async function setTask(content: string, reward: string) {
  try {
    await setDoc(doc(tasksRef, 'current'), {
      content,
      reward,
      timestamp: Date.now()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'tasks/current');
  }
}

export async function clearTask() {
  try {
    await deleteDoc(doc(tasksRef, 'current'));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'tasks/current');
  }
}
