import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { supabase, ProblemAttempt, ActivityLog } from '../lib/supabase';

type ProfileScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Profile'>;

interface Props {
  navigation: ProfileScreenNavigationProp;
}

interface ActivityCalendarData {
  [date: string]: {
    problemsSolved: number;
    stepsCompleted: number;
  };
}

export function ProfileScreen({ navigation }: Props) {
  const { user, profile, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalProblemsSolved: 0,
    totalStepsCompleted: 0,
    currentStreak: 0,
  });
  const [activityData, setActivityData] = useState<ActivityCalendarData>({});
  const [recentAttempts, setRecentAttempts] = useState<ProblemAttempt[]>([]);

  useEffect(() => {
    if (user) {
      loadUserData();
    }
  }, [user]);

  const loadUserData = async () => {
    setLoading(true);
    try {
      await Promise.all([loadStats(), loadActivityData(), loadRecentAttempts()]);
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    if (!user) return;

    // Get total solved problems
    const { count: solvedCount } = await supabase
      .from('problem_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_solved', true);

    // Get total steps (sum all steps from all attempts)
    const { data: attempts } = await supabase
      .from('problem_attempts')
      .select('steps')
      .eq('user_id', user.id);

    const totalSteps = attempts?.reduce((sum, attempt) => {
      return sum + (Array.isArray(attempt.steps) ? attempt.steps.length : 0);
    }, 0) || 0;

    setStats({
      totalProblemsSolved: solvedCount || 0,
      totalStepsCompleted: totalSteps,
      currentStreak: 0, // TODO: Calculate streak
    });
  };

  const loadActivityData = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('activity_log')
      .select('*')
      .eq('user_id', user.id)
      .order('activity_date', { ascending: false })
      .limit(365);

    const activityMap: ActivityCalendarData = {};
    data?.forEach((log: ActivityLog) => {
      activityMap[log.activity_date] = {
        problemsSolved: log.problems_solved,
        stepsCompleted: log.steps_completed,
      };
    });

    setActivityData(activityMap);
  };

  const loadRecentAttempts = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('problem_attempts')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_solved', true)
      .order('completed_at', { ascending: false })
      .limit(10);

    setRecentAttempts(data || []);
  };

  const handleSignOut = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          navigation.replace('Login');
        },
      },
    ]);
  };

  const renderActivityCalendar = () => {
    const today = new Date();
    const weeks: Date[][] = [];
    let currentWeek: Date[] = [];

    // Generate last 12 weeks
    for (let i = 83; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);

      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
      currentWeek.push(date);
    }

    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }

    const getActivityLevel = (date: Date) => {
      const dateStr = date.toISOString().split('T')[0];
      const activity = activityData[dateStr];
      if (!activity || activity.problemsSolved === 0) return 0;
      if (activity.problemsSolved >= 5) return 4;
      if (activity.problemsSolved >= 3) return 3;
      if (activity.problemsSolved >= 2) return 2;
      return 1;
    };

    const getColor = (level: number) => {
      const colors = ['#1a2742', '#0e4429', '#006d32', '#26a641', '#39d353'];
      return colors[level];
    };

    return (
      <View style={styles.calendarContainer}>
        <Text style={styles.sectionTitle}>Activity Calendar</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.calendar}>
            {weeks.map((week, weekIndex) => (
              <View key={weekIndex} style={styles.calendarColumn}>
                {week.map((date, dayIndex) => (
                  <View
                    key={dayIndex}
                    style={[
                      styles.calendarDay,
                      { backgroundColor: getColor(getActivityLevel(date)) },
                    ]}
                  />
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
        <View style={styles.calendarLegend}>
          <Text style={styles.legendText}>Less</Text>
          {[0, 1, 2, 3, 4].map(level => (
            <View
              key={level}
              style={[styles.legendBox, { backgroundColor: getColor(level) }]}
            />
          ))}
          <Text style={styles.legendText}>More</Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3252ff" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </Pressable>
          <Pressable onPress={handleSignOut} style={styles.signOutButton}>
            <Text style={styles.signOutButtonText}>Sign Out</Text>
          </Pressable>
        </View>

        {/* Profile Info */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{profile?.full_name?.[0]?.toUpperCase() || 'U'}</Text>
          </View>
          <Text style={styles.name}>{profile?.full_name || 'User'}</Text>
          <Text style={styles.email}>{profile?.email}</Text>
        </View>

        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.totalProblemsSolved}</Text>
            <Text style={styles.statLabel}>Problems Solved</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.totalStepsCompleted}</Text>
            <Text style={styles.statLabel}>Steps Completed</Text>
          </View>
        </View>

        {/* Activity Calendar */}
        {renderActivityCalendar()}

        {/* Recent Activity */}
        <View style={styles.recentActivity}>
          <Text style={styles.sectionTitle}>Recently Solved</Text>
          {recentAttempts.length === 0 ? (
            <Text style={styles.emptyText}>No solved problems yet. Start solving!</Text>
          ) : (
            recentAttempts.map(attempt => (
              <View key={attempt.id} style={styles.activityItem}>
                <Text style={styles.activityQuestion} numberOfLines={2}>
                  {attempt.problem_question}
                </Text>
                <Text style={styles.activityDate}>
                  {new Date(attempt.completed_at!).toLocaleDateString()}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0b1020' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 20 },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    backgroundColor: '#243269',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  backButtonText: { color: '#e6ecff', fontWeight: '600' },
  signOutButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  signOutButtonText: { color: '#ff8c8c', fontWeight: '600' },
  profileCard: {
    backgroundColor: '#131a33',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1f2a4d',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#3252ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  avatarText: { color: '#fff', fontSize: 32, fontWeight: '700' },
  name: { color: '#f3f6ff', fontSize: 24, fontWeight: '700', marginBottom: 4 },
  email: { color: '#9bb0ff', fontSize: 14 },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#131a33',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1f2a4d',
  },
  statValue: { color: '#3252ff', fontSize: 32, fontWeight: '700', marginBottom: 4 },
  statLabel: { color: '#9bb0ff', fontSize: 12, textAlign: 'center' },
  calendarContainer: {
    backgroundColor: '#131a33',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1f2a4d',
  },
  sectionTitle: { color: '#f3f6ff', fontSize: 18, fontWeight: '700', marginBottom: 16 },
  calendar: {
    flexDirection: 'row',
    gap: 3,
  },
  calendarColumn: {
    gap: 3,
  },
  calendarDay: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
  calendarLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 12,
  },
  legendText: { color: '#7f8bc7', fontSize: 10 },
  legendBox: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
  recentActivity: {
    backgroundColor: '#131a33',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1f2a4d',
  },
  emptyText: { color: '#7f8bc7', fontSize: 14, fontStyle: 'italic', textAlign: 'center' },
  activityItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2a4d',
  },
  activityQuestion: { color: '#e6ecff', fontSize: 14, marginBottom: 4 },
  activityDate: { color: '#7f8bc7', fontSize: 12 },
});

