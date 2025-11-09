import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  ActivityIndicator,
  SafeAreaView,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList, Problem } from "../types";
import { loadProblems, getAllTags, filterProblemsByTags, paginateProblems, ProblemData, areProblemsLoaded, getCachedProblems, getCachedTags } from "../problemsData";
import { useAuth } from "../contexts/AuthContext";

type ProblemsListScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "ProblemsList"
>;

interface Props {
  navigation: ProblemsListScreenNavigationProp;
}

const PAGE_SIZE = 20;

export function ProblemsListScreen({ navigation }: Props) {
  const { profile } = useAuth();
  
  // Initialize with cached data if available (prevents flash on Fast Refresh)
  const [allProblems, setAllProblems] = useState<ProblemData[]>(getCachedProblems());
  const [allTags, setAllTags] = useState<string[]>(getCachedTags());
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(0);
  const hasLoadedRef = useRef(false);
  
  // Only show loading if data isn't already cached
  const [loading, setLoading] = useState(!areProblemsLoaded());

  // Load problems on mount - only once
  useEffect(() => {
    if (hasLoadedRef.current) {
      console.log('⏭️ Already loaded, skipping...');
      setLoading(false); // Ensure loading is false if already loaded
      return;
    }

    hasLoadedRef.current = true;

    async function init() {
      try {
        console.log('🔄 Starting to load problems and tags...');
        const [problems, tags] = await Promise.all([
          loadProblems(),
          getAllTags(),
        ]);
        console.log(`✅ Loaded ${problems.length} problems and ${tags.length} unique tags`);
        setAllProblems(problems);
        setAllTags(tags);
      } catch (error) {
        console.error('❌ Error in init:', error);
      } finally {
        setLoading(false);
      }
    }
    
    init();
  }, []);

  // Filter and paginate problems
  const { filteredProblems, displayedProblems, totalPages } = useMemo(() => {
    let filtered = allProblems;
    
    // Apply search query - supports comma-separated tags or general text search
    if (searchQuery.trim()) {
      const searchTerms = searchQuery.toLowerCase().split(',').map(t => t.trim()).filter(Boolean);
      
      filtered = filtered.filter(p => {
        const questionLower = p.question.toLowerCase();
        const tagNames = p.skill_tags.map(t => t.toLowerCase());
        
        // Each search term must match either the question or a tag
        return searchTerms.every(term =>
          questionLower.includes(term) || tagNames.some(tag => tag.includes(term))
        );
      });
    }
    
    const displayed = paginateProblems(filtered, currentPage, PAGE_SIZE);
    const pages = Math.ceil(filtered.length / PAGE_SIZE);
    
    return { filteredProblems: filtered, displayedProblems: displayed, totalPages: pages };
  }, [allProblems, searchQuery, currentPage]);

  const addTagToSearch = (tag: string) => {
    // Add tag to search query if not already there
    const currentTags = searchQuery.split(',').map(t => t.trim()).filter(Boolean);
    if (!currentTags.includes(tag)) {
      const newQuery = currentTags.length > 0 
        ? `${searchQuery}, ${tag}` 
        : tag;
      setSearchQuery(newQuery);
      setCurrentPage(0);
    }
  };

  const handleProblemPress = (problemData: ProblemData) => {
    // Convert ProblemData to Problem format
    const problem: Problem = {
      id: problemData.id,
      question: problemData.question,
      canonicalAnswer: extractAnswer(problemData.answer),
      skill_tags: problemData.skill_tags,
    };
    navigation.navigate("ProblemSolve", { problem });
  };

  // Extract the final answer from the answer text
  // This is a simple heuristic - adjust based on your data
  const extractAnswer = (answerText: string): string => {
    // Try to find the last number or expression in the answer
    const matches = answerText.match(/(\d+\.?\d*)/g);
    return matches ? matches[matches.length - 1] : "unknown";
  };

  // Show loading ONLY on the very first load when we truly have no cached data
  if (allProblems.length === 0 && loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3252ff" />
          <Text style={styles.loadingText}>Loading problems...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>OrcaMath Problems</Text>
            <Text style={styles.subtitle}>
              {filteredProblems.length.toLocaleString()} of {allProblems.length.toLocaleString()} problems
            </Text>
          </View>
          <Pressable 
            style={styles.profileButton}
            onPress={() => navigation.navigate('Profile')}
          >
            <View style={styles.profileAvatar}>
              <Text style={styles.profileAvatarText}>
                {profile?.full_name?.[0]?.toUpperCase() || 'U'}
              </Text>
            </View>
          </Pressable>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by question or tags (comma-separated)..."
            placeholderTextColor="#7f8bc7"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <Pressable 
              style={styles.clearSearchButton} 
              onPress={() => {
                setSearchQuery('');
                setCurrentPage(0);
              }}
            >
              <Text style={styles.clearSearchText}>✕</Text>
            </Pressable>
          )}
        </View>

        {searchQuery.length > 0 && (
          <Text style={styles.searchHint}>
            💡 Tip: Click tags on problems to add filters
          </Text>
        )}

        {/* Problems List */}
        <FlatList
          data={displayedProblems}
          keyExtractor={item => String(item.id)}
          renderItem={({ item }) => (
            <View style={styles.problemCard}>
              <Pressable onPress={() => handleProblemPress(item)}>
                <Text style={styles.problemId}>#{item.id}</Text>
                <Text style={styles.problemQuestion} numberOfLines={3}>
                  {item.question}
                </Text>
              </Pressable>
              <View style={styles.problemTags}>
                {item.skill_tags.map((tag, idx) => (
                  <Pressable
                    key={idx}
                    style={styles.problemTag}
                    onPress={() => addTagToSearch(tag)}
                  >
                    <Text style={styles.problemTagText}>{tag}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                No problems match your filters
              </Text>
            </View>
          }
        />

        {/* Pagination */}
        {totalPages > 1 && (
          <View style={styles.pagination}>
            <Pressable
              style={[styles.pageButton, currentPage === 0 && styles.pageButtonDisabled]}
              onPress={() => setCurrentPage(p => Math.max(0, p - 1))}
              disabled={currentPage === 0}
            >
              <Text style={styles.pageButtonText}>← Prev</Text>
            </Pressable>
            <Text style={styles.pageInfo}>
              Page {currentPage + 1} of {totalPages}
            </Text>
            <Pressable
              style={[
                styles.pageButton,
                currentPage >= totalPages - 1 && styles.pageButtonDisabled,
              ]}
              onPress={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={currentPage >= totalPages - 1}
            >
              <Text style={styles.pageButtonText}>Next →</Text>
            </Pressable>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0b1020" },
  container: { flex: 1, padding: 16 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  profileButton: {
    marginTop: 4,
  },
  profileAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#3252ff",
    alignItems: "center",
    justifyContent: "center",
  },
  profileAvatarText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0b1020",
  },
  loadingText: { color: "#9bb0ff", marginTop: 16, fontSize: 16 },
  loadingSubtext: { color: "#7f8bc7", marginTop: 8, fontSize: 14 },
  title: { color: "#f3f6ff", fontSize: 28, fontWeight: "700", marginBottom: 4 },
  subtitle: { color: "#9bb0ff", fontSize: 14 },
  searchContainer: {
    position: "relative",
    marginBottom: 8,
  },
  searchInput: {
    backgroundColor: "#131a33",
    borderColor: "#243269",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingRight: 48,
    color: "#e6ecff",
    fontSize: 16,
  },
  clearSearchButton: {
    position: "absolute",
    right: 12,
    top: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#243269",
    alignItems: "center",
    justifyContent: "center",
  },
  clearSearchText: { color: "#9bb0ff", fontSize: 16, fontWeight: "600" },
  searchHint: {
    color: "#7f8bc7",
    fontSize: 12,
    marginBottom: 16,
    fontStyle: "italic",
  },
  listContent: { paddingBottom: 20 },
  problemCard: {
    backgroundColor: "#131a33",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#1f2a4d",
  },
  problemId: { color: "#7f8bc7", fontSize: 12, marginBottom: 8 },
  problemQuestion: {
    color: "#e6ecff",
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 12,
  },
  problemTags: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  problemTag: {
    backgroundColor: "#0e1430",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1f2a4d",
  },
  problemTagText: { color: "#9bb0ff", fontSize: 11 },
  emptyContainer: {
    padding: 40,
    alignItems: "center",
  },
  emptyText: { color: "#7f8bc7", fontSize: 16, textAlign: "center" },
  pagination: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: "#1f2a4d",
  },
  pageButton: {
    backgroundColor: "#243269",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  pageButtonDisabled: { opacity: 0.3 },
  pageButtonText: { color: "#e6ecff", fontWeight: "600" },
  pageInfo: { color: "#9bb0ff", fontSize: 14 },
});


