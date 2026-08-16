// Map Max Motors / car-dealer Supabase tables into chatbot catalog items.

function carTitle(car) {
  return [car.make, car.model, car.year].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

function formatPrice(price) {
  const n = Number(price);
  if (!n || Number.isNaN(n)) return '';
  return `${n.toLocaleString('ar-SA')} ر.س`;
}

export function mapCarRecord(car) {
  const title = carTitle(car);
  if (!title) return null;

  const descParts = [
    car.description,
    car.color && `اللون: ${car.color}`,
    car.fuelType && `الوقود: ${car.fuelType}`,
    car.bodyType && `النوع: ${car.bodyType}`,
    car.transmission && `ناقل الحركة: ${car.transmission}`,
    car.mileage > 0 && `الممشى: ${Number(car.mileage).toLocaleString('ar-SA')} كم`,
    formatPrice(car.price) && `السعر: ${formatPrice(car.price)}`,
    car.status && `الحالة: ${car.status}`,
    car.featured && 'سيارة مميزة',
    car.testDriveAvailable && 'تجربة قيادة متاحة',
  ].filter(Boolean);

  return {
    id: String(car.id),
    title,
    description: descParts.join(' — '),
    path: `/cars/${car.id}`,
    type: 'car',
    subject: (car.make || '').trim(),
    grade: (car.bodyType || '').trim(),
    source: 'supabase',
  };
}

export function mapBankRecord(bank) {
  if (!bank?.name) return null;
  const descParts = [
    bank.interestRate != null && `فائدة: ${bank.interestRate}%`,
    bank.loanPolicy,
    bank.minInsurancePremium != null && `أقل قسط تأمين: ${bank.minInsurancePremium}`,
  ].filter(Boolean);

  return {
    id: String(bank.id),
    title: bank.name,
    description: descParts.join(' — '),
    path: '/banks',
    type: 'bank',
    source: 'supabase',
  };
}

export function mapMandebRecord(row) {
  if (!row?.name) return null;
  return {
    id: String(row.id),
    title: row.name,
    description: [row.city && `المدينة: ${row.city}`, row.phone && `الهاتف: ${row.phone}`]
      .filter(Boolean)
      .join(' — '),
    path: '/companies',
    type: 'company',
    source: 'supabase',
  };
}

export function mapFeaturedModelRecord(row) {
  const title = (row.nameAr || row.name || '').trim();
  if (!title) return null;
  return {
    id: String(row.id),
    title,
    description: 'موديل مميز',
    path: '/featured-models',
    type: 'featured',
    source: 'supabase',
  };
}

export function mapArticleRecord(row) {
  const title = (row.title || row.name || '').trim();
  if (!title) return null;
  return {
    id: String(row.id),
    title,
    description: (row.summary || row.description || row.content || '').slice(0, 200),
    path: row.slug ? `/articles/${row.slug}` : '/articles',
    type: 'article',
    source: 'supabase',
  };
}

export function mapReviewRecord(row) {
  const title = (row.title || row.customerName || row.name || 'تقييم').trim();
  return {
    id: String(row.id),
    title,
    description: (row.comment || row.content || row.text || '').slice(0, 200),
    path: '/reviews',
    type: 'review',
    source: 'supabase',
  };
}

export const CAR_SUPABASE_QUERIES = [
  {
    path: 'Car?select=id,make,model,year,price,mileage,color,fuelType,transmission,bodyType,description,status,featured,testDriveAvailable&status=eq.AVAILABLE&order=featured.desc,updatedAt.desc&limit=150',
    map: mapCarRecord,
  },
  {
    path: 'Bank?select=id,name,interestRate,loanPolicy,minInsurancePremium&order=name.asc&limit=30',
    map: mapBankRecord,
  },
  {
    path: 'Mandeb?select=id,name,phone,city&order=name.asc&limit=30',
    map: mapMandebRecord,
  },
  {
    path: 'FeaturedModel?select=id,name,nameAr&isActive=eq.true&order=order.asc&limit=20',
    map: mapFeaturedModelRecord,
  },
  {
    path: 'Article?select=id,title,slug,content&order=createdAt.desc&limit=20',
    map: mapArticleRecord,
  },
  {
    path: 'Review?select=*&order=createdAt.desc&limit=20',
    map: mapReviewRecord,
  },
];
