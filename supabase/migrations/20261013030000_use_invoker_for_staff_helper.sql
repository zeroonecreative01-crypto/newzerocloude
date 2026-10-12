-- The helper only reads the signed-in user's own profile, so it does not need elevated privileges.
alter function public.is_staff() security invoker;
revoke execute on function public.is_staff() from public, anon;
grant execute on function public.is_staff() to authenticated;
