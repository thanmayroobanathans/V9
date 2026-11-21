import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { Person, Post } from '../../lib/social'

export type Stack = {
  Tabs: undefined
  Person: { person: Person }
  Chat: { matchId: string }
  Post: { owner: Person; post: Post }
  NewPost: undefined
  EditProfile: undefined
  Quiz: undefined
  Settings: undefined
  Lists: { tab: 'followers' | 'following' }
  Report: { target?: Person }
  Legal: { tab: 'terms' | 'privacy' }
}
export type Props<K extends keyof Stack> = NativeStackScreenProps<Stack, K>
