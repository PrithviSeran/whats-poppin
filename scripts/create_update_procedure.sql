-- Create a function to update event coordinates
create or replace function update_event_coordinates(
  event_id bigint,
  new_latitude double precision,
  new_longitude double precision
) returns void as $$
begin
  update new_events
  set 
    latitude = new_latitude,
    longitude = new_longitude
  where id = event_id;
end;
$$ language plpgsql security definer; 