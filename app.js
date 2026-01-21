import { db } from './firebase-config.js';
import { 
    collection, 
    addDoc, 
    onSnapshot, 
    deleteDoc, 
    doc, 
    query, 
    orderBy, 
    serverTimestamp,
    updateDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Referencias al DOM
const quoteForm = document.getElementById('quote-form');
const quotesContainer = document.getElementById('quotes-container');
const totalQuotesBadge = document.getElementById('total-quotes');
const toastInfo = document.getElementById('toast');

// Constantes
const COLLECTION_NAME = 'quotes';

// --- FUNCIONES UTILITARIAS ---

// Mostrar notificación simple
const showToast = (message, type = 'success') => {
    toastInfo.textContent = message;
    toastInfo.className = `fixed bottom-5 right-5 px-6 py-3 rounded shadow-lg transform transition-transform duration-300 z-50 ${type === 'success' ? 'bg-green-600' : 'bg-red-600'} text-white`;
    
    // Slide in
    toastInfo.classList.remove('translate-y-20', 'opacity-0');
    
    setTimeout(() => {
        // Slide out
        toastInfo.classList.add('translate-y-20', 'opacity-0');
    }, 3000);
};

// Formatear moneda
const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

// --- LOGICA FIREBASE ---

// 1. Crear Cotización
quoteForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const clientName = document.getElementById('client').value;
    const projectType = document.getElementById('type').value;
    const description = document.getElementById('description').value;
    const price = parseFloat(document.getElementById('price').value);

    // Validación básica
    if (!clientName || !price) {
        showToast('Por favor completa los campos requeridos', 'error');
        return;
    }

    try {
        const docRef = await addDoc(collection(db, COLLECTION_NAME), {
            client: clientName,
            type: projectType,
            description: description,
            price: price,
            status: 'pendiente', // pendiente, aprobada, rechazada
            createdAt: serverTimestamp()
        });
        
        console.log("Documento escrito con ID: ", docRef.id);
        quoteForm.reset();
        showToast('Cotización guardada correctamente');
    } catch (e) {
        console.error("Error añadiendo documento: ", e);
        showToast('Error al guardar en Firebase', 'error');
    }
});

// 2. Leer Cotizaciones en Tiempo Real
const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));

const unsubscribe = onSnapshot(q, (querySnapshot) => {
    quotesContainer.innerHTML = '';
    
    // Actualizar contador
    totalQuotesBadge.textContent = querySnapshot.size;

    if (querySnapshot.empty) {
        quotesContainer.innerHTML = `
            <div class="text-center py-10 bg-white rounded-lg shadow text-gray-500">
                <p>No hay cotizaciones registradas aún.</p>
            </div>
        `;
        return;
    }

    querySnapshot.forEach((docSnap) => {
        const quote = docSnap.data();
        const id = docSnap.id;
        
        // Determinar color del estado
        let statusColor = 'bg-yellow-100 text-yellow-800';
        if(quote.status === 'aprobada') statusColor = 'bg-green-100 text-green-800';
        if(quote.status === 'rechazada') statusColor = 'bg-red-100 text-red-800';

        const card = document.createElement('div');
        card.className = "bg-white rounded-lg shadow hover:shadow-md transition-shadow duration-200 overflow-hidden border-l-4 border-primary";
        
        card.innerHTML = `
            <div class="p-5">
                <div class="flex justify-between items-start mb-2">
                    <div>
                        <h3 class="font-bold text-lg text-gray-800">${quote.client}</h3>
                        <span class="text-xs text-gray-500 uppercase tracking-wide font-semibold">${quote.type}</span>
                    </div>
                    <span class="px-3 py-1 rounded-full text-xs font-bold uppercase cursor-pointer select-none ${statusColor}" onclick="window.toggleStatus('${id}', '${quote.status}')" title="Click para cambiar estado">
                        ${quote.status}
                    </span>
                </div>
                
                <p class="text-gray-600 text-sm mb-4 line-clamp-2">${quote.description}</p>
                
                <div class="flex justify-between items-center pt-3 border-t border-gray-100">
                    <span class="text-xl font-bold text-gray-800">${formatCurrency(quote.price)}</span>
                    <div class="space-x-2">
                         <button onclick="window.deleteQuote('${id}')" class="text-red-500 hover:text-red-700 text-sm font-medium transition-colors">
                            Eliminar
                        </button>
                    </div>
                </div>
            </div>
        `;
        quotesContainer.appendChild(card);
    });
}, (error) => {
    console.error("Error obteniendo datos: ", error);
    quotesContainer.innerHTML = `<p class="text-red-500 text-center">Error cargando datos. Revisa tu configuración de Firebase.</p>`;
});

// --- ACCIONES GLOBALES (Para poder llamarlas desde el HTML onClick) ---

// 3. Eliminar Cotización
window.deleteQuote = async (id) => {
    if(confirm('¿Estás seguro de eliminar esta cotización?')) {
        try {
            await deleteDoc(doc(db, COLLECTION_NAME, id));
            showToast('Cotización eliminada');
        } catch (error) {
            console.error("Error eliminando: ", error);
            showToast('Error al eliminar', 'error');
        }
    }
};

// 4. Cambiar Estado (Ejemplo simple de update)
window.toggleStatus = async (id, currentStatus) => {
    const states = ['pendiente', 'aprobada', 'rechazada'];
    const nextIndex = (states.indexOf(currentStatus) + 1) % states.length;
    const nextStatus = states[nextIndex];

    try {
        await updateDoc(doc(db, COLLECTION_NAME, id), {
            status: nextStatus
        });
        // No necesitamos feedback visual extra, el onSnapshot actualizará la UI automáticamente
    } catch (error) {
        console.error("Error actualizando: ", error);
        showToast('Error al actualizar estado', 'error');
    }
};
