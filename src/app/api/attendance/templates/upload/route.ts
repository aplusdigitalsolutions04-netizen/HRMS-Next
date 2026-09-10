// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission, uuidv4 } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import * as xlsx from 'xlsx';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!checkPermission(user, 'upload_attendance')) return jsonError('Insufficient permissions', 403);

    const fd = await req.formData();
    const file = fd.get('file');
    if (!file || !(file instanceof File)) return jsonError('No file uploaded', 422);

    const activeTemplates = await query<RowDataPacket[]>('SELECT columns FROM attendance_templates WHERE is_active=1 LIMIT 1');
    if (activeTemplates.length === 0) {
      return jsonError('No active attendance template found. Please activate a template first.', 400);
    }

    const templateCols = typeof activeTemplates[0].columns === 'string' 
      ? JSON.parse(activeTemplates[0].columns) 
      : activeTemplates[0].columns;

    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = xlsx.read(buffer, { type: 'buffer', cellDates: true });
    const sheetName = wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];
    const rawData = xlsx.utils.sheet_to_json(sheet, { defval: '' });

    if (rawData.length === 0) {
      return jsonError('Uploaded file is empty', 400);
    }

    let inserted = 0;
    for (const row of rawData) {
      const dataRow: Record<string, any> = {};
      
      // Map Excel columns to DB columns using the template
      for (const col of templateCols) {
        let val = row[col.label];
        if (col.key === 'date' && val) {
          try {
            const d = new Date(val);
            if (!isNaN(d.getTime())) {
              val = d.toISOString().split('T')[0];
            }
          } catch (e) {}
        }
        dataRow[col.key] = val;
      }

      if (!dataRow.emp_code || !dataRow.date) continue; // Skip rows without essential data

      // Check if this attendance record already exists
      const existing = await query<RowDataPacket[]>('SELECT id FROM attendance WHERE emp_code=? AND attendance_date=?', [dataRow.emp_code, dataRow.date]);
      
      if (existing.length > 0) {
        await execute(
          `UPDATE attendance SET in_time=?, out_time=?, status=?, remark=?, updated_at=NOW() WHERE id=?`,
          [dataRow.in_time || '', dataRow.out_time || '', dataRow.status || '', dataRow.remark || '', existing[0].id]
        );
      } else {
        await execute(
          `INSERT INTO attendance (id, emp_code, name, department, attendance_date, day, shift, in_time, out_time, work_plus_ot, ot, less_hrs, status, remark, created_by) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            uuidv4(),
            dataRow.emp_code,
            dataRow.name || '',
            dataRow.department || '',
            dataRow.date,
            dataRow.day || '',
            dataRow.shift || '',
            dataRow.in_time || '',
            dataRow.out_time || '',
            dataRow.work_ot || '',
            dataRow.ot || '',
            dataRow.less_hrs || '',
            dataRow.status || '',
            dataRow.remark || '',
            user.email || user.id
          ]
        );
      }
      inserted++;
    }

    return jsonSuccess({ message: `Successfully processed ${inserted} attendance records.`, filename: file.name });
  } catch (e: any) { 
    console.error('Error uploading attendance:', e);
    return jsonError(e, 500); 
  }
}
