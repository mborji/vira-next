import { createClient } from '@supabase/supabase-js';
import sql from 'mssql';
import 'dotenv/config';

// Supabase and SQL Server configurations
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const sqlConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    options: {
        encrypt: true,
        trustServerCertificate: true
    }
};

async function migrateData() {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.log('Supabase credentials not found. Please add SUPABASE_URL and SUPABASE_SERVICE_KEY to your .env file');
        return;
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    let pool;
    let transaction;

    try {
        pool = await sql.connect(sqlConfig);
        console.log('Connected to SQL Server. Starting data migration...');

        transaction = new sql.Transaction(pool);
        await transaction.begin();

        // Migration Order (to respect Foreign Key constraints)
        // 1. users
        // 2. profiles
        // 3. blogs
        // 4. contact_submissions
        // 5. ticket_responses
        // 6. time_logs
        // 7. day_off_requests

        // Migrate 'users'
        console.log('Migrating users...');
        const { data: users, error: usersError } = await supabase.from('users').select('*');
        if (usersError) throw usersError;
        for (const user of users) {
            await transaction.request()
                .input('id', sql.UniqueIdentifier, user.id)
                .input('email', sql.NVarChar, user.email)
                .input('password_hash', sql.NVarChar, user.password_hash)
                .input('created_at', sql.DateTime2, new Date(user.created_at))
                .input('updated_at', sql.DateTime2, new Date(user.updated_at))
                .query(`
                    SET IDENTITY_INSERT users ON;
                    INSERT INTO users (id, email, password_hash, created_at, updated_at)
                    VALUES (@id, @email, @password_hash, @created_at, @updated_at);
                    SET IDENTITY_INSERT users OFF;
                `);
        }
        console.log(`Migrated ${users.length} users.`);
        
        // Migrate 'profiles'
        console.log('Migrating profiles...');
        const { data: profiles, error: profilesError } = await supabase.from('profiles').select('*');
        if (profilesError) throw profilesError;
        for (const profile of profiles) {
            await transaction.request()
                .input('id', sql.UniqueIdentifier, profile.id)
                .input('user_id', sql.UniqueIdentifier, profile.user_id)
                .input('email', sql.NVarChar, profile.email)
                .input('full_name', sql.NVarChar, profile.full_name)
                .input('role', sql.NVarChar, profile.role)
                .input('created_at', sql.DateTime2, new Date(profile.created_at))
                .input('updated_at', sql.DateTime2, new Date(profile.updated_at))
                .query(`
                    SET IDENTITY_INSERT profiles ON;
                    INSERT INTO profiles (id, user_id, email, full_name, role, created_at, updated_at)
                    VALUES (@id, @user_id, @email, @full_name, @role, @created_at, @updated_at);
                    SET IDENTITY_INSERT profiles OFF;
                `);
        }
        console.log(`Migrated ${profiles.length} profiles.`);

        // Migrate 'blogs'
        console.log('Migrating blogs...');
        const { data: blogs, error: blogsError } = await supabase.from('blogs').select('*');
        if (blogsError) throw blogsError;
        for (const blog of blogs) {
            await transaction.request()
                .input('id', sql.UniqueIdentifier, blog.id)
                .input('author_id', sql.UniqueIdentifier, blog.author_id)
                .input('title', sql.NVarChar, blog.title)
                .input('content', sql.NVarChar(sql.MAX), blog.content)
                .input('excerpt', sql.NVarChar, blog.excerpt)
                .input('slug', sql.NVarChar, blog.slug)
                .input('published', sql.Bit, blog.published)
                .input('featured_image_url', sql.NVarChar, blog.featured_image_url)
                .input('created_at', sql.DateTime2, new Date(blog.created_at))
                .input('updated_at', sql.DateTime2, new Date(blog.updated_at))
                .query(`
                    SET IDENTITY_INSERT blogs ON;
                    INSERT INTO blogs (id, author_id, title, content, excerpt, slug, published, featured_image_url, created_at, updated_at)
                    VALUES (@id, @author_id, @title, @content, @excerpt, @slug, @published, @featured_image_url, @created_at, @updated_at);
                    SET IDENTITY_INSERT blogs OFF;
                `);
        }
        console.log(`Migrated ${blogs.length} blogs.`);
        
        // Migrate 'contact_submissions'
        console.log('Migrating contact submissions...');
        const { data: submissions, error: submissionsError } = await supabase.from('contact_submissions').select('*');
        if (submissionsError) throw submissionsError;
        for (const submission of submissions) {
            await transaction.request()
                .input('id', sql.UniqueIdentifier, submission.id)
                .input('user_id', sql.UniqueIdentifier, submission.user_id)
                .input('name', sql.NVarChar, submission.name)
                .input('email', sql.NVarChar, submission.email)
                .input('phone', sql.NVarChar, submission.phone)
                .input('subject', sql.NVarChar, submission.subject)
                .input('message', sql.NVarChar(sql.MAX), submission.message)
                .input('status', sql.NVarChar, submission.status)
                .input('admin_notes', sql.NVarChar(sql.MAX), submission.admin_notes)
                .input('reviewed_by', sql.UniqueIdentifier, submission.reviewed_by)
                .input('reviewed_at', sql.DateTime2, submission.reviewed_at ? new Date(submission.reviewed_at) : null)
                .input('created_at', sql.DateTime2, new Date(submission.created_at))
                .input('updated_at', sql.DateTime2, new Date(submission.updated_at))
                .query(`
                    SET IDENTITY_INSERT contact_submissions ON;
                    INSERT INTO contact_submissions (id, user_id, name, email, phone, subject, message, status, admin_notes, reviewed_by, reviewed_at, created_at, updated_at)
                    VALUES (@id, @user_id, @name, @email, @phone, @subject, @message, @status, @admin_notes, @reviewed_by, @reviewed_at, @created_at, @updated_at);
                    SET IDENTITY_INSERT contact_submissions OFF;
                `);
        }
        console.log(`Migrated ${submissions.length} contact submissions`);

        // Migrate 'ticket_responses'
        console.log('Migrating ticket responses...');
        const { data: responses, error: responsesError } = await supabase.from('ticket_responses').select('*');
        if (responsesError) throw responsesError;
        for (const response of responses) {
            await transaction.request()
                .input('id', sql.UniqueIdentifier, response.id)
                .input('submission_id', sql.UniqueIdentifier, response.submission_id)
                .input('message', sql.NVarChar(sql.MAX), response.message)
                .input('is_admin_response', sql.Bit, response.is_admin_response)
                .input('created_at', sql.DateTime2, new Date(response.created_at))
                .input('updated_at', sql.DateTime2, new Date(response.updated_at))
                .query(`
                    SET IDENTITY_INSERT ticket_responses ON;
                    INSERT INTO ticket_responses (id, submission_id, message, is_admin_response, created_at, updated_at)
                    VALUES (@id, @submission_id, @message, @is_admin_response, @created_at, @updated_at);
                    SET IDENTITY_INSERT ticket_responses OFF;
                `);
        }
        console.log(`Migrated ${responses.length} ticket responses`);

        // Migrate 'time_logs'
        console.log('Migrating time logs...');
        const { data: timeLogs, error: timeLogsError } = await supabase.from('time_logs').select('*');
        if (timeLogsError) throw timeLogsError;
        for (const timeLog of timeLogs) {
            await transaction.request()
                .input('id', sql.UniqueIdentifier, timeLog.id)
                .input('worker_id', sql.UniqueIdentifier, timeLog.worker_id)
                .input('date', sql.Date, new Date(timeLog.date))
                .input('hours_worked', sql.Decimal(5, 2), timeLog.hours_worked)
                .input('description', sql.NVarChar, timeLog.description)
                .input('created_at', sql.DateTime2, new Date(timeLog.created_at))
                .input('updated_at', sql.DateTime2, new Date(timeLog.updated_at))
                .query(`
                    SET IDENTITY_INSERT time_logs ON;
                    INSERT INTO time_logs (id, worker_id, date, hours_worked, description, created_at, updated_at)
                    VALUES (@id, @worker_id, @date, @hours_worked, @description, @created_at, @updated_at);
                    SET IDENTITY_INSERT time_logs OFF;
                `);
        }
        console.log(`Migrated ${timeLogs.length} time logs`);

        // Migrate 'day_off_requests'
        console.log('Migrating day off requests...');
        const { data: dayOffRequests, error: dayOffError } = await supabase.from('day_off_requests').select('*');
        if (dayOffError) throw dayOffError;
        for (const request of dayOffRequests) {
            await transaction.request()
                .input('id', sql.UniqueIdentifier, request.id)
                .input('worker_id', sql.UniqueIdentifier, request.worker_id)
                .input('request_date', sql.Date, new Date(request.request_date))
                .input('reason', sql.NVarChar, request.reason)
                .input('status', sql.NVarChar, request.status)
                .input('admin_notes', sql.NVarChar, request.admin_notes)
                .input('reviewed_by', sql.UniqueIdentifier, request.reviewed_by)
                .input('reviewed_at', sql.DateTime2, request.reviewed_at ? new Date(request.reviewed_at) : null)
                .input('created_at', sql.DateTime2, new Date(request.created_at))
                .input('updated_at', sql.DateTime2, new Date(request.updated_at))
                .query(`
                    SET IDENTITY_INSERT day_off_requests ON;
                    INSERT INTO day_off_requests (id, worker_id, request_date, reason, status, admin_notes, reviewed_by, reviewed_at, created_at, updated_at)
                    VALUES (@id, @worker_id, @request_date, @reason, @status, @admin_notes, @reviewed_by, @reviewed_at, @created_at, @updated_at);
                    SET IDENTITY_INSERT day_off_requests OFF;
                `);
        }
        console.log(`Migrated ${dayOffRequests.length} day off requests`);

        await transaction.commit();
        console.log('Data migration completed successfully!');

    } catch (error) {
        console.error('Migration error:', error);
        if (transaction) {
            try {
                await transaction.rollback();
                console.log('Transaction rolled back due to error.');
            } catch (rollbackError) {
                console.error('Rollback error:', rollbackError);
            }
        }
    } finally {
        if (pool) {
            await pool.close();
        }
    }
}

migrateData();