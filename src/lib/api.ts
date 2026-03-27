import { createClient } from '@supabase/supabase-js';

// 请确保在 Supabase 后台设置了对应的表：users, letters, goals
// 并开启了 RLS 策略
const supabaseUrl = 'https://moislwnnlfallinzvzem.supabase.co';
// 注意：下面的 Key 看起来可能不正确，请在 Supabase Settings -> API -> anon public key 中复制最长的那个字符串替换它
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1vaXNsd25ubGZhbGxpbnp2emVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1Mjk0MDIsImV4cCI6MjA5MDEwNTQwMn0.kGdcBwhKTCsdZBxeOfZ39rudqgWfsidvYvwWKFHQWd4';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const api = {
  async signup(data: { phone: string; password?: string; name: string }) {
    // Supabase 默认使用邮箱登录，我们可以用 phone 作为标识符
    // 或者直接在 users 表里创建记录（如果不需要 Supabase Auth 的话）
    // 这里我们采用最简单的方式：直接操作数据库表，模拟登录
    
    // 1. 检查用户是否存在
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('phone', data.phone)
      .single();

    if (existingUser) throw new Error('该手机号已注册');

    // 2. 创建用户
    const { data: newUser, error } = await supabase
      .from('users')
      .insert([{ 
        phone: data.phone, 
        password: data.password, // 生产环境建议加密，这里为了演示直接存储
        name: data.name,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw new Error(error.message);
    
    localStorage.setItem('user_id', newUser.id);
    return newUser;
  },

  async login(data: { phone: string; password?: string }) {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('phone', data.phone)
      .eq('password', data.password)
      .single();

    if (error || !user) throw new Error('手机号或密码错误');

    localStorage.setItem('user_id', user.id);
    return user;
  },

  async getMe() {
    const userId = localStorage.getItem('user_id');
    if (!userId) throw new Error('未登录');

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      localStorage.removeItem('user_id');
      throw new Error('会话过期');
    }
    return user;
  },

  async updateName(name: string) {
    const userId = localStorage.getItem('user_id');
    const { data, error } = await supabase
      .from('users')
      .update({ name })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  async getLetters() {
    const userId = localStorage.getItem('user_id');
    const { data, error } = await supabase
      .from('letters')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) return [];
    return data;
  },

  async addLetter(letterData: any) {
    const userId = localStorage.getItem('user_id');
    const { data, error } = await supabase
      .from('letters')
      .insert([{ ...letterData, user_id: userId }])
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  async deleteLetter(id: string) {
    const { error } = await supabase
      .from('letters')
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);
    return { success: true };
  },

  async getGoals() {
    const userId = localStorage.getItem('user_id');
    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) return [];
    return data;
  },

  async addGoal(goalData: any) {
    const userId = localStorage.getItem('user_id');
    const { data, error } = await supabase
      .from('goals')
      .insert([{ ...goalData, user_id: userId }])
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  async toggleGoal(id: string) {
    // 先获取当前状态
    const { data: current } = await supabase
      .from('goals')
      .select('completed')
      .eq('id', id)
      .single();
    
    const { data, error } = await supabase
      .from('goals')
      .update({ completed: !current?.completed })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  async deleteGoal(id: string) {
    const { error } = await supabase
      .from('goals')
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);
    return { success: true };
  },

  async updateBirthDate(birthDate: string) {
    const userId = localStorage.getItem('user_id');
    const { data, error } = await supabase
      .from('users')
      .update({ birthDate })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  logout() {
    localStorage.removeItem('user_id');
  }
};
