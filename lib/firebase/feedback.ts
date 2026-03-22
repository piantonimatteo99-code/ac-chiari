import { collection, addDoc, getDocs, doc, updateDoc, query, orderBy, Timestamp } from 'firebase/firestore';
import { initializeFirebase } from '@/src/firebase';

const { firestore: db } = initializeFirebase();

export type FeedbackType = 'Miglioramento' | 'Problema';
export type FeedbackStatus = 'Nuovo' | 'In corso' | 'Risolto' | 'Rifiutato';
export type FeedbackPriority = 'Da valutare' | 'Bassa' | 'Media' | 'Alta';

export interface Feedback {
  id?: string;
  userId: string;
  userEmail: string;
  userName?: string;
  type: FeedbackType;
  description: string;
  url: string;
  status: FeedbackStatus;
  priority: FeedbackPriority;
  createdAt: Timestamp | Date | any; // allow any for flexibility on timestamps vs dates
}

const COLLECTION_NAME = 'feedbacks';

export const addFeedback = async (
  userId: string,
  userEmail: string,
  userName: string | undefined,
  type: FeedbackType,
  description: string,
  url: string
): Promise<string> => {
  try {
    const feedbackData: Omit<Feedback, 'id'> = {
      userId,
      userEmail,
      userName: userName || '',
      type,
      description,
      url,
      status: 'Nuovo',
      priority: 'Da valutare',
      createdAt: Timestamp.now(),
    };
    
    const docRef = await addDoc(collection(db, COLLECTION_NAME), feedbackData);
    return docRef.id;
  } catch (error) {
    console.error('Error adding feedback: ', error);
    throw error;
  }
};

export const getFeedbacks = async (): Promise<Feedback[]> => {
  try {
    const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id,
      createdAt: doc.data().createdAt?.toDate() || new Date(),
    })) as Feedback[];
  } catch (error) {
    console.error('Error getting feedbacks: ', error);
    throw error;
  }
};

export const updateFeedbackData = async (
  feedbackId: string, 
  dataToUpdate: Partial<Omit<Feedback, 'id' | 'createdAt'>>
): Promise<void> => {
  try {
    const feedbackRef = doc(db, COLLECTION_NAME, feedbackId);
    await updateDoc(feedbackRef, dataToUpdate);
  } catch (error) {
    console.error('Error updating feedback: ', error);
    throw error;
  }
};
