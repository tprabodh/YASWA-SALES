// src/pages/BulletinPage.jsx

import React, { useEffect, useState } from 'react';
import { Navigate }            from 'react-router-dom';
import { useUserProfile }      from '../hooks/useUserProfile';
import {
  collection,
  query,
  where,
  orderBy,
  getDocs
} from 'firebase/firestore';
import { jsPDF }               from 'jspdf';
import Modal                   from 'react-modal';
import { db }                  from '../firebase';

Modal.setAppElement('#root');

export default function BulletinPage() {
  const { profile, loading } = useUserProfile();
  const [bulletins, setBulletins]       = useState([]);
  const [loadingData, setLoadingData]   = useState(true);
  const [modalContent, setModalContent] = useState(null);

  useEffect(() => {
    if (loading || !profile) return;
    (async () => {
      setLoadingData(true);
      const snap = await getDocs(
        query(
          collection(db, 'bulletins'),
          where('roles', 'array-contains', profile.role),
          orderBy('createdAt', 'desc')
        )
      );
      setBulletins(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoadingData(false);
    })();
  }, [loading, profile]);

  if (loading)      return <p className="p-6">Loading…</p>;
  if (!profile)     return <Navigate to="/login" replace />;
  if (loadingData)  return <p className="p-6">Loading bulletins…</p>;

  const openModal  = b => setModalContent(b);
  const closeModal = () => setModalContent(null);

  const downloadText = (text, id) => {
    const pdf = new jsPDF();
    pdf.setFontSize(12);
    pdf.text(text, 20, 20, { maxWidth: 170 });
    pdf.save(`bulletin_${id}.pdf`);
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <h2 className="text-3xl font-bold text-indigo-600">Latest Bulletins</h2>

      {bulletins.length === 0 ? (
        <p className="text-gray-500">No bulletins available.</p>
      ) : (
        <div className="space-y-4">
          {bulletins.map(b => (
            <div
              key={b.id}
              className="flex flex-col md:flex-row items-start md:items-center bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-2xl transition p-4"
            >
              <div className="flex-1">
                <p className="text-xs text-gray-400 mb-1">
                  Posted: {b.createdAt?.toDate().toLocaleString() || '–'}
                </p>

                {/* Previews */}
                {b.contentType === 'text' && (
                  <p
                    className="text-gray-800 mb-2"
                    style={{
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}
                  >{b.content}</p>
                )}

                {b.contentType === 'link' && (
                  <a
                    href={b.content}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:underline mb-2 inline-block"
                  >
                    {b.content}
                  </a>
                )}

                {b.contentType === 'photo' && (
                  <p className="text-gray-800 mb-2 italic">Image Bulletin</p>
                )}

               

                {/* Actions */}
                <div className="space-x-2">
                  {/* View & Download for text and photo */}
                  {(b.contentType === 'text' || b.contentType === 'photo') && (
                    <>
                      <button
                        onClick={() => openModal(b)}
                        className="px-3 py-1 bg-indigo-500 text-white rounded hover:bg-indigo-600 text-sm"
                      >View</button>
                      {b.contentType === 'text' && (
                        <button
                          onClick={() => downloadText(b.content, b.id)}
                          className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                        >Download</button>
                      )}
                      {b.contentType === 'photo' && (
                        <a
                          href={b.content}
                          download
                          className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                        >Download</a>
                      )}
                    </>
                  )}

                  {/* For document: View and Download */}
                  {b.contentType === 'document' && (
                    <>
                      <a
                        href={b.content}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1 bg-indigo-500 text-white rounded hover:bg-indigo-600 text-sm"
                      >View</a>
                      <a
                        href={b.content}
                        download
                        className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                      >Download</a>
                    </>
                  )}
                </div>
              </div>

              {/* Thumbnail for photo */}
              {b.contentType === 'photo' && (
                <div className="w-16 h-16 md:w-24 md:h-24 overflow-hidden rounded ml-0 md:ml-4 mt-4 md:mt-0 flex-shrink-0">
                  <img
                    src={b.content}
                    alt="bulletin"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal for text/photo view */}
      <Modal
        isOpen={!!modalContent}
        onRequestClose={closeModal}
        className="fixed inset-0 flex items-center justify-center p-4 bg-black bg-opacity-50"
      >
        <div className="bg-white rounded-lg overflow-auto max-h-full p-6 max-w-lg">
          <button
            onClick={closeModal}
            className="text-gray-500 hover:text-gray-700 float-right"
          >✕</button>

          {modalContent?.contentType === 'photo' && (
            <img src={modalContent.content} alt="full" className="w-full h-auto rounded" />
          )}
          {modalContent?.contentType === 'text' && (
            <div className="prose">
              <p>{modalContent.content}</p>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
