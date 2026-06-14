import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import styles from './AdminPanel.module.css';

interface GalleryItem {
  id: string;
  title: string;
  category: string;
  imageUrl: string;
  createdAt?: string;
  updatedAt?: string;
}

interface Story {
  id: string;
  title: string;
  description: string;
  date: string;
  image?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

interface StatItem {
  id?: string;
  title: string;
  value: number;
  unit?: string | null;
  order?: number;
  createdAt?: string;
  updatedAt?: string;
}

interface ContactMessage {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  subject: string;
  message: string;
  status: 'pending' | 'read' | 'replied';
  createdAt?: string;
  updatedAt?: string;
}

interface ContactInfo {
  phone: string;
  email: string;
  address: string;
  socialLinks: {
    facebook: string;
    instagram: string;
    whatsapp: string;
  };
  emergencyNumber: string;
  businessHours: {
    weekday: string;
    weekend: string;
  };
}

interface Admin {
  id: string;
  email: string;
  name: string;
  picture: string | null;
  isActive: boolean;
  lastLogin: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Donation {
  id: string;
  amount: number;
  donorName: string;
  donorEmail: string;
  message: string | null;
  status: 'pending' | 'completed' | 'failed';
  createdAt?: string;
  updatedAt?: string;
}

interface Donor {
  id: string;
  name: string;
  category: string;
  logo?: string;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

type EditingItem = GalleryItem | Story | Admin | Donation | Donor | StatItem | Record<string, unknown> | null;
type FormDataType = Record<string, string | undefined>;

const AdminPanel: React.FC = () => {
  const { user, token, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'gallery' | 'stories' | 'statistics' | 'contact' | 'admins' | 'donations' | 'sponsors'>('admins');
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [statItems, setStatItems] = useState<StatItem[]>([]);
  const [contactMessages, setContactMessages] = useState<ContactMessage[]>([]);
  const [contactInfo, setContactInfo] = useState<ContactInfo | null>(null);
  const [contactSubTab, setContactSubTab] = useState<'messages' | 'info'>('messages');
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [sponsors, setSponsors] = useState<Donor[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingItem, setEditingItem] = useState<EditingItem>(null);
  const [formData, setFormData] = useState<FormDataType>({});
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const fetchData = React.useCallback(async () => {
    if (!token) return;
    setLoading(true);

    try {
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      if (activeTab === 'gallery') {
        const response = await fetch(`${API_URL}/api/admin/gallery`, { headers });
        const result = await response.json();
        if (result.success) setGalleryItems(result.data || []);
      } else if (activeTab === 'stories') {
        const response = await fetch(`${API_URL}/api/admin/stories`, { headers });
        const result = await response.json();
        if (result.success) setStories(result.data || []);
      } else if (activeTab === 'statistics') {
        const response = await fetch(`${API_URL}/api/admin/stat-items`, { headers });
        const result = await response.json();
        if (result.success) setStatItems(result.data || []);
      } else if (activeTab === 'contact') {
        // Fetch both contact messages and contact info
        const [messagesResponse, infoResponse] = await Promise.all([
          fetch(`${API_URL}/api/admin/contact-messages`, { headers }),
          fetch(`${API_URL}/api/admin/contact-info`, { headers })
        ]);
        
        const messagesResult = await messagesResponse.json();
        const infoResult = await infoResponse.json();
        
        if (messagesResult.success) setContactMessages(messagesResult.data || []);
        if (infoResult.success) setContactInfo(infoResult.data);
      } else if (activeTab === 'admins') {
        const response = await fetch(`${API_URL}/api/admin/admins`, { headers });
        const result = await response.json();
        console.log('Admins response:', result);
        if (result.success) setAdmins(result.data || []);
      } else if (activeTab === 'donations') {
        const response = await fetch(`${API_URL}/api/admin/donations`, { headers });
        const result = await response.json();
        if (result.success) setDonations(result.data || []);
      } else if (activeTab === 'sponsors') {
        const response = await fetch(`${API_URL}/api/admin/donors`, { headers });
        const result = await response.json();
        if (result.success) setSponsors(result.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }, [token, activeTab]);

  useEffect(() => {
    if (!user?.isAdmin) {
      console.log('User is not admin:', user);
      return;
    }
    console.log('Fetching data for tab:', activeTab);
    const timeoutId = window.setTimeout(() => {
      void fetchData();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [activeTab, user, token, fetchData]);

  const handleSave = async () => {
    if (!token || !editingItem) return;

    try {
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      let url = '';
      let method: 'PUT' | 'POST' = 'PUT';
      let body: Record<string, unknown> = formData;

      if (activeTab === 'gallery') {
        body = {
          title: formData.title || '',
          category: formData.category || '',
          imageUrl: formData.imageUrl || '',
        };
      } else if (activeTab === 'statistics') {
        const parsedValue = parseFloat(formData.value || '0');
        const parsedOrder = formData.order ? parseInt(formData.order, 10) : 0;
        body = {
          title: formData.title || '',
          value: Number.isFinite(parsedValue) ? parsedValue : 0,
          unit: formData.unit || undefined,
          order: Number.isFinite(parsedOrder) ? parsedOrder : 0,
        };
      } else if (activeTab === 'stories') {
        body = {
          title: formData.title || '',
          description: formData.description || '',
          date: formData.date || '',
          image: formData.image || undefined,
        };
      }

      if (activeTab === 'gallery') {
        url = editingItem.id
          ? `${API_URL}/api/admin/gallery/${editingItem.id}`
          : `${API_URL}/api/admin/gallery`;
        method = editingItem.id ? 'PUT' : 'POST';
      } else if (activeTab === 'stories') {
        url = editingItem.id
          ? `${API_URL}/api/admin/stories/${editingItem.id}`
          : `${API_URL}/api/admin/stories`;
        method = editingItem.id ? 'PUT' : 'POST';
      } else if (activeTab === 'statistics') {
        const isEdit = Boolean((editingItem as StatItem)?.id);
        url = isEdit
          ? `${API_URL}/api/admin/stat-items/${(editingItem as StatItem).id}`
          : `${API_URL}/api/admin/stat-items`;
        method = isEdit ? 'PUT' : 'POST';
      } else if (activeTab === 'admins') {
        url = editingItem.id
          ? `${API_URL}/api/admin/admins/${editingItem.id}`
          : `${API_URL}/api/admin/admins`;
        method = editingItem.id ? 'PUT' : 'POST';
      } else if (activeTab === 'donations') {
        url = `${API_URL}/api/admin/donations/${editingItem.id}`;
        method = 'PUT';
      } else if (activeTab === 'sponsors') {
        url = editingItem.id
          ? `${API_URL}/api/admin/donors/${editingItem.id}`
          : `${API_URL}/api/admin/donors`;
        method = editingItem.id ? 'PUT' : 'POST';
      }

      const response = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        alert('נשמר בהצלחה!');
        setEditingItem(null);
        setFormData({});
        fetchData();
      } else {
        alert(`שגיאה: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to save:', error);
      alert(`שגיאה בשמירה: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleDelete = async (id: number | string) => {
    if (!token) return;

    // Special handling for admins
    if (activeTab === 'admins') {
      // Check if trying to delete self
      if (user?.id === id) {
        alert('לא ניתן למחוק את עצמך');
        return;
      }
      
      // Check if this is the last admin
      if (admins.length <= 1) {
        alert('חייב להשאר לפחות אדמין אחד במערכת');
        return;
      }
    }

    if (!confirm('בטוח שברצונך למחוק?')) return;

    try {
      const headers = {
        'Authorization': `Bearer ${token}`,
      };

      let url = '';
      if (activeTab === 'gallery') {
        url = `${API_URL}/api/admin/gallery/${id}`;
      } else if (activeTab === 'stories') {
        url = `${API_URL}/api/admin/stories/${id}`;
      } else if (activeTab === 'admins') {
        url = `${API_URL}/api/admin/admins/${id}`;
        } else if (activeTab === 'statistics') {
          url = `${API_URL}/api/admin/stat-items/${id}`;
      } else if (activeTab === 'donations') {
        url = `${API_URL}/api/admin/donations/${id}`;
      } else if (activeTab === 'sponsors') {
        url = `${API_URL}/api/admin/donors/${id}`;
      }

      const response = await fetch(url, { method: 'DELETE', headers });
      const result = await response.json();

      if (response.ok && result.success) {
        alert('נמחק בהצלחה!');
        fetchData();
      } else {
        alert(`שגיאה: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to delete:', error);
      alert('שגיאה במחיקה');
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !token) return;

    setUploadingImage(true);
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('image', file);
      formDataToSend.append('folder', activeTab);

      const response = await fetch(`${API_URL}/api/admin/upload-image`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formDataToSend,
      });

      const result = await response.json();

      if (result.success && result.data) {
        // Set the uploaded image URL in the form
        // For admins tab, use 'picture' field instead of 'imageUrl'
        if (activeTab === 'admins') {
          setFormData({
            ...formData,
            picture: result.data.url,
          });
        } else if (activeTab === 'stories') {
          setFormData({
            ...formData,
            image: result.data.url,
          });
        } else {
          setFormData({
            ...formData,
            imageUrl: result.data.url,
            cloudinaryId: result.data.publicId,
          });
        }
        alert('תמונה הועלתה בהצלחה!');
      } else {
        alert(`שגיאה בהעלאה: ${result.error}`);
      }
    } catch (error) {
      console.error('Upload failed:', error);
      alert('שגיאה בהעלאת תמונה');
    } finally {
      setUploadingImage(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  if (!user?.isAdmin) {
    return (
      <div className={styles.container}>
        <div className={styles.unauthorized}>
          <h2>אתה לא מורשה לגשת לפאנל זה</h2>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          {user.picture && (
            <img
              src={user.picture}
              alt={user.name}
              style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover' }}
            />
          )}
          <div>
            <h1>פאנל ניהול</h1>
            <p>שלום, {user.name}</p>
          </div>
        </div>
        <button onClick={logout} className={styles.logoutBtn}>
          התנתק
        </button>
      </div>

      <div className={styles.tabs}>
        <button
          className={activeTab === 'admins' ? styles.active : ''}
          onClick={() => setActiveTab('admins')}
        >
          ניהול אדמינים
        </button>
        <button
          className={activeTab === 'statistics' ? styles.active : ''}
          onClick={() => setActiveTab('statistics')}
        >
          סטטיסטיקות
        </button>
        <button
          className={activeTab === 'stories' ? styles.active : ''}
          onClick={() => setActiveTab('stories')}
        >
          סיפורים
        </button>
        <button
          className={activeTab === 'gallery' ? styles.active : ''}
          onClick={() => setActiveTab('gallery')}
        >
          גלריה
        </button>
        <button
          className={activeTab === 'contact' ? styles.active : ''}
          onClick={() => setActiveTab('contact')}
        >
          יצירת קשר
        </button>
        <button
          className={activeTab === 'donations' ? styles.active : ''}
          onClick={() => setActiveTab('donations')}
        >
          תורמים כספיים
        </button>
        <button
          className={activeTab === 'sponsors' ? styles.active : ''}
          onClick={() => setActiveTab('sponsors')}
        >
          תורמים וחסויות
        </button>
      </div>

      <div className={styles.content}>
        {loading && <div className={styles.loading}>טוען...</div>}

        {activeTab === 'gallery' && !loading && (
          <div className={styles.section}>
            <button
              onClick={() => {
                setEditingItem({});
                setFormData({});
              }}
              className={styles.addBtn}
            >
              + הוסף תמונה
            </button>

            {editingItem && (
              <div className={styles.form}>
                <h3>{editingItem.id ? 'עריכת תמונה' : 'הוספת תמונה חדשה'}</h3>
                <input
                  type="text"
                  placeholder="כותרת"
                  value={formData.title || ''}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
                <input
                  type="text"
                  placeholder="קטגוריה"
                  value={formData.category || ''}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                />
                
                {/* Image Upload Section */}
                <div className={styles.imageUploadSection}>
                  <label>תמונה:</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={uploadingImage}
                    style={{ display: 'block', marginBottom: '0.5rem' }}
                  />
                  {uploadingImage && <p style={{ color: '#f2561a' }}>מעלה תמונה...</p>}
                </div>

                {/* Display uploaded image */}
                {formData.imageUrl && (
                  <div className={styles.imagePreview}>
                    <img
                      src={String(formData.imageUrl)}
                      alt="Preview"
                      style={{ maxWidth: '200px', maxHeight: '200px', borderRadius: '8px' }}
                    />
                    <small>URL: {String(formData.imageUrl).substring(0, 50)}...</small>
                  </div>
                )}
                
                <div className={styles.formButtons}>
                  <button onClick={handleSave} className={styles.saveBtn}>
                    שמור
                  </button>
                  <button
                    onClick={() => setEditingItem(null)}
                    className={styles.cancelBtn}
                  >
                    ביטול
                  </button>
                </div>
              </div>
            )}

            <div className={styles.itemsList}>
              {galleryItems.map((item) => (
                <div key={item.id} className={styles.item}>
                  {item.imageUrl && (
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className={styles.itemImage}
                    />
                  )}
                  <h4>{item.title}</h4>
                  <p>{item.category}</p>
                  <div className={styles.itemButtons}>
                    <button
                      onClick={() => {
                        setEditingItem(item);
                        setFormData({
                          title: item.title,
                          category: item.category,
                          imageUrl: item.imageUrl || '',
                        });
                      }}
                      className={styles.editBtn}
                    >
                      עריכה
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className={styles.deleteBtn}
                    >
                      מחיקה
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'stories' && !loading && (
          <div className={styles.section}>
            <button
              onClick={() => {
                setEditingItem({});
                setFormData({});
              }}
              className={styles.addBtn}
            >
              + הוסף סיפור
            </button>

            {editingItem && (
              <div className={styles.form}>
                <h3>{editingItem.id ? 'עריכת סיפור' : 'הוספת סיפור חדש'}</h3>
                <input
                  type="text"
                  placeholder="כותרת"
                  value={formData.title || ''}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
                <textarea
                  placeholder="תיאור"
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                />
                <input
                  type="text"
                  placeholder="תאריך"
                  value={formData.date || ''}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />

                {/* Image Upload Section */}
                <div className={styles.imageUploadSection}>
                  <label>תמונה (אופציונלי):</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={uploadingImage}
                    style={{ display: 'block', marginBottom: '0.5rem' }}
                  />
                  {uploadingImage && <p style={{ color: '#f2561a' }}>מעלה תמונה...</p>}
                </div>

                {/* Display uploaded image */}
                {formData.image && (
                  <div className={styles.imagePreview}>
                    <img
                      src={String(formData.image)}
                      alt="Preview"
                      style={{ maxWidth: '200px', maxHeight: '200px', borderRadius: '8px' }}
                    />
                    <small>URL: {String(formData.image).substring(0, 50)}...</small>
                  </div>
                )}

                <div className={styles.formButtons}>
                  <button onClick={handleSave} className={styles.saveBtn}>
                    שמור
                  </button>
                  <button
                    onClick={() => setEditingItem(null)}
                    className={styles.cancelBtn}
                  >
                    ביטול
                  </button>
                </div>
              </div>
            )}

            <div className={styles.itemsList}>
              {stories.map((story) => (
                <div key={story.id} className={styles.item}>
                  {story.image && (
                    <img
                      src={story.image}
                      alt={story.title}
                      className={styles.itemImage}
                    />
                  )}
                  <h4>{story.title}</h4>
                  <p>{story.description.substring(0, 100)}...</p>
                  <p className={styles.date}>{story.date}</p>
                  <div className={styles.itemButtons}>
                    <button
                      onClick={() => {
                        setEditingItem(story);
                        setFormData({
                          title: story.title,
                          description: story.description,
                          date: story.date,
                          image: story.image || '',
                        });
                      }}
                      className={styles.editBtn}
                    >
                      עריכה
                    </button>
                    <button
                      onClick={() => handleDelete(story.id)}
                      className={styles.deleteBtn}
                    >
                      מחיקה
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'statistics' && !loading && (
          <div className={styles.section}>
            <h3>ניהול סטטיסטיקות (כל נתון בנפרד)</h3>

            <button
              onClick={() => {
                setEditingItem({});
                setFormData({ title: '', value: '0', unit: '', order: String(statItems.length + 1) });
              }}
              className={styles.addBtn}
            >
              + הוסף נתון סטטיסטי
            </button>

            {editingItem && activeTab === 'statistics' && (
              <div className={styles.form}>
                <h3>{(editingItem as StatItem)?.id ? 'עריכת נתון' : 'נתון חדש'}</h3>

                <input
                  type="text"
                  placeholder="כותרת (לדוגמה: מתנדבים פעילים)"
                  value={formData.title || ''}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />

                <input
                  type="number"
                  placeholder="ערך מספרי"
                  value={formData.value || ''}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                />

                <input
                  type="text"
                  placeholder="יחידה (אופציונלי, למשל דקות / % )"
                  value={formData.unit || ''}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                />

                <input
                  type="number"
                  placeholder="סדר תצוגה (מספר קטן יוצג ראשון)"
                  value={formData.order || ''}
                  onChange={(e) => setFormData({ ...formData, order: e.target.value })}
                />

                <div className={styles.formButtons}>
                  <button onClick={handleSave} className={styles.saveBtn}>
                    שמור
                  </button>
                  <button
                    onClick={() => {
                      setEditingItem(null);
                      setFormData({});
                    }}
                    className={styles.cancelBtn}
                  >
                    ביטול
                  </button>
                </div>
              </div>
            )}

            {statItems.length === 0 && !editingItem && (
              <p className={styles.emptyState}>אין נתונים. הוסף פריט סטטיסטיקה ראשון.</p>
            )}

            {statItems.length > 0 && (
              <div className={styles.statisticsView}>
                {statItems.map((item) => (
                  <div key={item.id} className={styles.statCard}>
                    <div className={styles.statCardHeader}>
                      <h4>{item.title}</h4>
                      {typeof item.order === 'number' && (
                        <span className={styles.statOrder}>#{item.order}</span>
                      )}
                    </div>
                    <div className={styles.statValueRow}>
                      <span className={styles.statValue}>{item.value}</span>
                      {item.unit && <span className={styles.statUnit}>{item.unit}</span>}
                    </div>
                    <div className={styles.itemButtons}>
                      <button
                        onClick={() => {
                          setEditingItem(item);
                          setFormData({
                            title: item.title,
                            value: String(item.value),
                            unit: item.unit || '',
                            order: item.order !== undefined ? String(item.order) : '',
                          });
                        }}
                        className={styles.editBtn}
                      >
                        עריכה
                      </button>
                      <button
                        onClick={() => item.id && handleDelete(item.id)}
                        className={styles.deleteBtn}
                      >
                        מחיקה
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'contact' && !loading && (
          <div className={styles.section}>
            <div className={styles.contactSubTabs}>
              <button
                className={contactSubTab === 'messages' ? styles.active : ''}
                onClick={() => setContactSubTab('messages')}
              >
                הודעות ({contactMessages.length})
              </button>
              <button
                className={contactSubTab === 'info' ? styles.active : ''}
                onClick={() => setContactSubTab('info')}
              >
                פרטי קשר
              </button>
            </div>

            {contactSubTab === 'messages' && (
              <div className={styles.messagesSection}>
                <h3>הודעות יצירת קשר</h3>
                {contactMessages.length === 0 ? (
                  <p className={styles.emptyState}>אין הודעות כרגע</p>
                ) : (
                  <div className={styles.messagesList}>
                    {contactMessages.map((msg) => (
                      <div key={msg.id} className={styles.messageCard}>
                        <div className={styles.messageHeader}>
                          <h4>{msg.name}</h4>
                          <span className={`${styles.statusBadge} ${styles[msg.status]}`}>
                            {msg.status === 'pending' && 'בהמתנה'}
                            {msg.status === 'read' && 'נקרא'}
                            {msg.status === 'replied' && 'נענה'}
                          </span>
                        </div>
                        <p className={styles.messageEmail}>{msg.email}</p>
                        <p className={styles.messageText}>{msg.message}</p>
                        <p className={styles.messageTime}>
                          {new Date(msg.createdAt || '').toLocaleString('he-IL')}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {contactSubTab === 'info' && contactInfo && (
              <div className={styles.contactInfoSection}>
                <h3>עדכון פרטי קשר</h3>
                <div className={styles.form}>
                  <input
                    type="text"
                    placeholder="טלפון"
                    value={formData.phone || contactInfo?.phone || ''}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                  <input
                    type="email"
                    placeholder="אימייל"
                    value={formData.email || contactInfo?.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                  <input
                    type="text"
                    placeholder="כתובת"
                    value={formData.address || contactInfo?.address || ''}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                  <input
                    type="text"
                    placeholder="מספר חירום"
                    value={formData.emergencyNumber || contactInfo?.emergencyNumber || ''}
                    onChange={(e) => setFormData({ ...formData, emergencyNumber: e.target.value })}
                  />
                  
                  <h4 style={{ marginTop: '1rem' }}>רשתות חברתיות</h4>
                  <input
                    type="text"
                    placeholder="Facebook"
                    value={formData.facebook || contactInfo?.socialLinks?.facebook || ''}
                    onChange={(e) => setFormData({ ...formData, facebook: e.target.value })}
                  />
                  <input
                    type="text"
                    placeholder="Instagram"
                    value={formData.instagram || contactInfo?.socialLinks?.instagram || ''}
                    onChange={(e) => setFormData({ ...formData, instagram: e.target.value })}
                  />
                  <input
                    type="text"
                    placeholder="WhatsApp"
                    value={formData.whatsapp || contactInfo?.socialLinks?.whatsapp || ''}
                    onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                  />
                  
                  <div className={styles.formButtons}>
                    <button 
                      onClick={async () => {
                        if (!token) return;
                        try {
                          const response = await fetch(`${API_URL}/api/admin/contact-info`, {
                            method: 'PUT',
                            headers: {
                              'Authorization': `Bearer ${token}`,
                              'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                              phone: formData.phone || contactInfo?.phone,
                              email: formData.email || contactInfo?.email,
                              address: formData.address || contactInfo?.address,
                              emergencyNumber: formData.emergencyNumber || contactInfo?.emergencyNumber,
                              socialLinks: {
                                facebook: formData.facebook || contactInfo?.socialLinks?.facebook || '',
                                instagram: formData.instagram || contactInfo?.socialLinks?.instagram || '',
                                whatsapp: formData.whatsapp || contactInfo?.socialLinks?.whatsapp || '',
                              },
                            }),
                          });
                          const result = await response.json();
                          if (result.success) {
                            alert('פרטי הקשר עודכנו בהצלחה!');
                            setFormData({});
                            fetchData();
                          } else {
                            alert(`שגיאה: ${result.error}`);
                          }
                        } catch (error) {
                          console.error('Failed to save contact info:', error);
                          alert('שגיאה בשמירת פרטי הקשר');
                        }
                      }}
                      className={styles.saveBtn}
                    >
                      שמור
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'admins' && !loading && (
          <div className={styles.section}>
            <button
              onClick={() => {
                setEditingItem({});
                setFormData({});
              }}
              className={styles.addBtn}
            >
              + הוסף אדמין
            </button>

            {editingItem && (
              <div className={styles.form}>
                <h3>{editingItem.id ? 'עריכת אדמין' : 'הוספת אדמין חדש'}</h3>
                <input
                  type="email"
                  placeholder="אימייל (נדרש לצורך כניסה)"
                  value={formData.email || ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
                <input
                  type="text"
                  placeholder="שם מלא"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
                
                {/* Image Upload Section */}
                <div className={styles.imageUploadSection}>
                  <label>תמונת פרופיל (אופציונלי):</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={uploadingImage}
                    style={{ display: 'block', marginBottom: '0.5rem' }}
                  />
                  {uploadingImage && <p style={{ color: '#f2561a' }}>מעלה תמונה...</p>}
                </div>

                {/* Display uploaded image */}
                {formData.picture && (
                  <div className={styles.imagePreview}>
                    <img
                      src={String(formData.picture)}
                      alt="Admin Photo"
                      style={{ maxWidth: '100px', maxHeight: '100px', borderRadius: '50%', objectFit: 'cover' }}
                    />
                  </div>
                )}
                
                <div className={styles.formButtons}>
                  <button onClick={handleSave} className={styles.saveBtn}>
                    שמור
                  </button>
                  <button
                    onClick={() => {
                      setEditingItem(null);
                      setFormData({});
                      if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                      }
                    }}
                    className={styles.cancelBtn}
                  >
                    ביטול
                  </button>
                </div>
              </div>
            )}

            <div className={styles.adminsList}>
              <h3>רשימת אדמינים ({admins.length})</h3>
              {admins.length === 0 ? (
                <p className={styles.emptyState}>אין אדמינים</p>
              ) : (
                <div className={styles.grid}>
                  {admins.map((admin) => (
                    <div key={admin.id} className={styles.card}>
                      <div className={styles.adminHeader}>
                        {admin.picture && (
                          <img 
                            src={admin.picture} 
                            alt={admin.name}
                            className={styles.adminPhoto}
                          />
                        )}
                        <div>
                          <h4>{admin.name}</h4>
                          <p className={styles.adminEmail}>{admin.email}</p>
                        </div>
                      </div>
                      <div className={styles.adminInfo}>
                        <p className={styles.adminDate}>
                          נוסף ב: {new Date(admin.createdAt).toLocaleDateString('he-IL')}
                        </p>
                        {admin.lastLogin && (
                          <p className={styles.adminAddedBy}>
                            ההתחברות האחרונה: {new Date(admin.lastLogin).toLocaleDateString('he-IL')}
                          </p>
                        )}
                      </div>
                      <div className={styles.actions}>
                        <button
                          onClick={() => {
                            setEditingItem(admin);
                            setFormData({
                              email: admin.email,
                              name: admin.name,
                              picture: admin.picture || '',
                            });
                          }}
                          className={styles.editBtn}
                        >
                          ערוך
                        </button>
                        <button
                          onClick={() => handleDelete(admin.id)}
                          disabled={user?.id === admin.id || admins.length <= 1}
                          style={{
                            ...{},
                            opacity: user?.id === admin.id || admins.length <= 1 ? 0.5 : 1,
                            cursor: user?.id === admin.id || admins.length <= 1 ? 'not-allowed' : 'pointer'
                          }}
                          title={user?.id === admin.id ? 'לא ניתן למחוק את עצמך' : admins.length <= 1 ? 'חייב להשאר אדמין אחד לפחות' : 'מחק אדמין'}
                          className={styles.deleteBtn}
                        >
                          מחק
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'donations' && !loading && (
          <div className={styles.section}>
            <h3>ניהול תורמים כספיים</h3>
            <div className={styles.adminsList}>
              <h3>רשימת תורמים ({donations.length})</h3>
              {donations.length === 0 ? (
                <p className={styles.emptyState}>אין תורמים כרגע</p>
              ) : (
                <div className={styles.grid}>
                  {donations.map((donation: Donation) => (
                    <div key={donation.id} className={styles.card}>
                      <div className={styles.adminHeader}>
                        <div>
                          <h4>{donation.donorName}</h4>
                          <p className={styles.adminEmail}>{donation.donorEmail}</p>
                        </div>
                      </div>
                      <div className={styles.adminInfo}>
                        <p className={styles.adminDate}>
                          סכום: ₪{donation.amount}
                        </p>
                        <p className={styles.adminAddedBy}>
                          תאריך: {new Date(donation.createdAt || '').toLocaleDateString('he-IL')}
                        </p>
                        {donation.message && (
                          <p className={styles.adminAddedBy}>
                            הערה: {donation.message}
                          </p>
                        )}
                        <p className={styles.adminAddedBy}>
                          סטטוס: {donation.status}
                        </p>
                      </div>
                      <div className={styles.actions}>
                        <button
                          onClick={() => {
                            setEditingItem(donation);
                            setFormData({
                              status: donation.status,
                            });
                          }}
                          className={styles.editBtn}
                        >
                          ערוך סטטוס
                        </button>
                        <button
                          onClick={() => handleDelete(donation.id)}
                          className={styles.deleteBtn}
                        >
                          מחק
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {editingItem && activeTab === 'donations' && (
              <div className={styles.form}>
                <h3>עדכון סטטוס תרומה</h3>
                <select
                  value={formData.status || 'completed'}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  style={{ width: '100%', padding: '12px', marginBottom: '15px', borderRadius: '6px', border: '1px solid #d0d0c8' }}
                >
                  <option value="pending">ממתין</option>
                  <option value="completed">הושלם</option>
                  <option value="failed">נכשל</option>
                </select>
                <div className={styles.formButtons}>
                  <button onClick={handleSave} className={styles.saveBtn}>
                    שמור
                  </button>
                  <button
                    onClick={() => {
                      setEditingItem(null);
                      setFormData({});
                    }}
                    className={styles.cancelBtn}
                  >
                    ביטול
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'sponsors' && !loading && (
          <div className={styles.section}>
            <h3>ניהול תורמים וחסויות</h3>
            <button
              onClick={() => {
                setEditingItem({ id: '', name: '', category: '' });
                setFormData({ name: '', category: '' });
              }}
              className={styles.addBtn}
            >
              + הוסף תורם חדש
            </button>

            {editingItem && typeof editingItem === 'object' && 'category' in editingItem && (
              <div className={styles.form}>
                <h3>{editingItem.id ? 'עריכת תורם' : 'הוספת תורם חדש'}</h3>
                <input
                  type="text"
                  placeholder="שם התורם/חברה"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
                <input
                  type="text"
                  placeholder="קטגוריה (תורם, שותף, וכו')"
                  value={formData.category || ''}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                />
                <div className={styles.formButtons}>
                  <button onClick={handleSave} className={styles.saveBtn}>
                    שמור
                  </button>
                  <button
                    onClick={() => {
                      setEditingItem(null);
                      setFormData({});
                    }}
                    className={styles.cancelBtn}
                  >
                    ביטול
                  </button>
                </div>
              </div>
            )}

            <div className={styles.adminsList}>
              <h3>רשימת תורמים ({sponsors.length})</h3>
              {sponsors.length === 0 ? (
                <p className={styles.emptyState}>אין תורמים כרגע</p>
              ) : (
                <div className={styles.grid}>
                  {sponsors.map((sponsor: Donor) => (
                    <div key={sponsor.id} className={styles.card}>
                      <div className={styles.adminHeader}>
                        <div>
                          <h4>{sponsor.name}</h4>
                          <p className={styles.adminEmail}>{sponsor.category}</p>
                        </div>
                      </div>
                      <div className={styles.actions}>
                        <button
                          onClick={() => {
                            setEditingItem(sponsor);
                            setFormData({
                              name: sponsor.name,
                              category: sponsor.category,
                            });
                          }}
                          className={styles.editBtn}
                        >
                          ערוך
                        </button>
                        <button
                          onClick={() => handleDelete(sponsor.id)}
                          className={styles.deleteBtn}
                        >
                          מחק
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
